/**
 * User Service
 * Handles user registration, profile management, and authentication
 * All business logic separated from controller
 */

const User = require('../models/User');
const crypto = require('crypto');
const SqlUserService = require('./SqlUserService');
const CloudinaryStorageService = require('./CloudinaryStorageService');
const {
  ValidationError,
  validateEmail,
  validatePassword,
  validateRequiredField,
  validatePhoneNumber,
} = require('./ValidationService');
const generateToken = require('../utils/generateToken');

class UserService {
  hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  getClientContext(context = {}) {
    const userAgent = String(context.userAgent || '');
    const browser = userAgent.includes('Edg/')
      ? 'Microsoft Edge'
      : userAgent.includes('Chrome/')
        ? 'Chrome'
        : userAgent.includes('Firefox/')
          ? 'Firefox'
          : userAgent.includes('Safari/')
            ? 'Safari'
            : 'Unknown browser';

    const osType = userAgent.includes('Windows')
      ? 'Windows'
      : userAgent.includes('Android')
        ? 'Android'
        : userAgent.includes('iPhone') || userAgent.includes('iPad')
          ? 'iOS'
          : userAgent.includes('Mac OS')
            ? 'macOS'
            : userAgent.includes('Linux')
              ? 'Linux'
              : 'Unknown OS';

    return {
      ipAddress: String(context.ipAddress || ''),
      userAgent,
      browser,
      osType,
      deviceName: context.deviceName || `${browser} on ${osType}`,
    };
  }

  createOtp() {
    return String(crypto.randomInt(100000, 999999));
  }

  async createSession(user, context = {}) {
    const client = this.getClientContext(context);
    const sessionId = crypto.randomUUID();
    const token = generateToken(user._id, sessionId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const recentFailures = (user.auth?.loginHistory || [])
      .filter((item) => item.status === 'failure' && Date.now() - new Date(item.createdAt).getTime() < 30 * 60 * 1000)
      .length;
    const knownDevice = (user.auth?.sessions || []).some(
      (session) => !session.revokedAt && session.userAgent === client.userAgent && session.ipAddress === client.ipAddress
    );
    const suspicious = recentFailures >= 3 || (!knownDevice && (user.auth?.sessions || []).some((session) => !session.revokedAt));

    user.auth = user.auth || {};
    user.auth.sessions = (user.auth.sessions || []).filter(
      (session) => !session.expiresAt || session.expiresAt > new Date()
    );
    user.auth.sessions.push({
      sessionId,
      tokenHash: this.hashValue(token),
      ...client,
      suspicious,
      expiresAt,
    });
    user.auth.devices = user.auth.devices || [];
    user.auth.devices.push({
      deviceId: sessionId,
      deviceName: client.deviceName,
      osType: client.osType,
      lastLoginAt: new Date(),
      ipAddress: client.ipAddress,
    });
    user.auth.loginHistory = [
      {
        status: 'success',
        email: user.email,
        ...client,
        suspicious,
      },
      ...(user.auth.loginHistory || []),
    ].slice(0, 50);
    user.auth.failedLoginCount = 0;
    user.auth.lockedUntil = undefined;

    await user.save();
    return token;
  }

  async recordFailedLogin(user, email, context = {}, reason = 'Invalid email or password') {
    if (!user) return;

    const client = this.getClientContext(context);
    user.auth = user.auth || {};
    const failedLoginCount = (user.auth.failedLoginCount || 0) + 1;
    user.auth.failedLoginCount = failedLoginCount;
    user.auth.lockedUntil = failedLoginCount >= 8
      ? new Date(Date.now() + 15 * 60 * 1000)
      : user.auth.lockedUntil;
    user.auth.loginHistory = [
      {
        status: 'failure',
        email,
        ...client,
        suspicious: failedLoginCount >= 3,
        reason,
      },
      ...(user.auth.loginHistory || []),
    ].slice(0, 50);

    await user.save();
  }

  /**
   * Format user for response (exclude sensitive data)
   */
  async formatUserResponse(user, tokenOrInclude = false) {
    const accounts = await require('./AccountService').getAccountsByUser(user._id);
    const activeSessions = (user.auth?.sessions || [])
      .filter((session) => !session.revokedAt && (!session.expiresAt || session.expiresAt > new Date()))
      .map((session) => ({
        sessionId: session.sessionId,
        deviceName: session.deviceName,
        osType: session.osType,
        browser: session.browser,
        ipAddress: session.ipAddress,
        suspicious: Boolean(session.suspicious),
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      }));
    
    const userData = {
      _id: user._id,
      name: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
      email: user.email,
      phone: user.phoneNumber || null,
      preferredCurrency: user.profile.currency,
      avatar: user.profile.avatar || null,
      dateOfBirth: user.profile.dateOfBirth || null,
      gender: user.profile.gender || null,
      bio: user.profile.bio || null,
      occupation: user.profile.occupation || null,
      address: user.profile.address || null,
      preferredLanguage: user.profile.preferredLanguage || null,
      timezone: user.profile.timezone || null,
      kycStatus: user.kycStatus,
      preferences: user.preferences,
      verification: {
        emailVerified: Boolean(user.auth?.emailVerification?.verified),
        phoneVerified: Boolean(user.auth?.phoneVerification?.verified),
      },
      security: {
        activeSessions,
        recentLoginHistory: (user.auth?.loginHistory || []).slice(0, 10).map((item) => ({
          status: item.status,
          ipAddress: item.ipAddress,
          deviceName: item.deviceName,
          osType: item.osType,
          browser: item.browser,
          suspicious: Boolean(item.suspicious),
          reason: item.reason,
          createdAt: item.createdAt,
        })),
      },
      spendingCategories: user.spendingCategories,
      linkedAccounts: accounts,
      savedContacts: user.savedContacts || [],
      generatedQRCodes: user.generatedQRCodes || [],
      createdAt: user.createdAt,
    };

    if (typeof tokenOrInclude === 'string') {
      userData.token = tokenOrInclude;
    } else if (tokenOrInclude) {
      userData.token = generateToken(user._id);
    }

    return userData;
  }

  /**
   * Register a new user
   * Validates: name, email, password
   * Returns: user data + token
   */
  async registerUser(registrationData, context = {}) {
    const { name, email, password, phone, preferredCurrency, spendingCategories } =
      registrationData;

    // Validation
    validateRequiredField(name, 'Name');
    validateRequiredField(email, 'Email');
    validateRequiredField(password, 'Password');
    validateEmail(email);
    validatePassword(password);

    if (phone) {
      validatePhoneNumber(phone);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ValidationError('User already exists with this email', 'email');
    }

    // Parse name
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');

    // Create user (password is hashed by User model pre-save hook)
    const user = await User.create({
      email: email.toLowerCase(),
      password, // Triggers virtual setter which sets _password
      phoneNumber: phone,
      profile: {
        firstName,
        lastName,
        currency: preferredCurrency || 'INR',
      },
      spendingCategories: spendingCategories || undefined,
    });

    // Create default account (using direct import to avoid circular dependency in index.js)
    const AccountService = require('./AccountService');
    await AccountService.createDefaultAccount(user._id);
    await SqlUserService.upsertFromMongoUser(user);

    const token = await this.createSession(user, context);
    return await this.formatUserResponse(user, token);
  }

  /**
   * Authenticate user and return token
   */
  async loginUser(email, password, context = {}) {
    validateRequiredField(email, 'Email');
    validateRequiredField(password, 'Password');
    validateEmail(email);

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new ValidationError('Invalid email or password');
    }

    if (user.auth?.lockedUntil && user.auth.lockedUntil > new Date()) {
      await this.recordFailedLogin(user, email, context, 'Account temporarily locked');
      throw new ValidationError('Too many failed attempts. Try again later.');
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      await this.recordFailedLogin(user, email, context);
      throw new ValidationError('Invalid email or password');
    }

    const token = await this.createSession(user, context);
    return await this.formatUserResponse(user, token);
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      throw new Error('User not found');
    }

    return await this.formatUserResponse(user);
  }

  /**
   * Update user profile
   * Handles: name, phone, currency, categories, contacts, preferences
   */
  async updateUserProfile(userId, updateData) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const { 
      name, phone, preferredCurrency, spendingCategories, savedContacts, password, preferences,
      dateOfBirth, gender, bio, occupation, address, preferredLanguage, timezone 
    } = updateData;

    // Update name if provided
    if (name !== undefined) {
      const [firstName, ...rest] = name.split(' ');
      user.profile.firstName = firstName;
      user.profile.lastName = rest.join(' ');
    }

    // Update phone if provided
    if (phone !== undefined) {
      if (phone) {
        validatePhoneNumber(phone);
      }
      user.phoneNumber = phone;
    }

    // Update currency
    if (preferredCurrency !== undefined) {
      user.profile.currency = preferredCurrency;
    }

    // Update extended profile fields
    if (dateOfBirth !== undefined) user.profile.dateOfBirth = dateOfBirth;
    if (gender !== undefined) user.profile.gender = gender;
    if (bio !== undefined) user.profile.bio = bio;
    if (occupation !== undefined) user.profile.occupation = occupation;
    if (preferredLanguage !== undefined) user.profile.preferredLanguage = preferredLanguage;
    if (timezone !== undefined) user.profile.timezone = timezone;
    if (address !== undefined) {
      user.profile.address = {
        street: address.street ?? user.profile.address?.street,
        city: address.city ?? user.profile.address?.city,
        state: address.state ?? user.profile.address?.state,
        country: address.country ?? user.profile.address?.country,
        postalCode: address.postalCode ?? user.profile.address?.postalCode,
      };
    }

    // Update spending categories
    if (spendingCategories !== undefined) {
      if (!Array.isArray(spendingCategories)) {
        throw new ValidationError('Spending categories must be an array', 'spendingCategories');
      }
      user.spendingCategories = spendingCategories;
    }

    // Update saved contacts
    if (savedContacts !== undefined) {
      if (!Array.isArray(savedContacts)) {
        throw new ValidationError('Saved contacts must be an array', 'savedContacts');
      }
      user.savedContacts = savedContacts;
    }

    // Removed linkedAccounts update logic as it is now handled by AccountService

    // Update password if provided
    if (password !== undefined) {
      validatePassword(password);
      user.password = password; // Triggers virtual setter
    }

    // Update preferences
    if (preferences !== undefined) {
      user.preferences.notificationEnabled =
        preferences.notificationEnabled ?? user.preferences.notificationEnabled;
      user.preferences.darkMode = preferences.darkMode ?? user.preferences.darkMode;
    }

    const updatedUser = await user.save();
    await SqlUserService.upsertFromMongoUser(updatedUser);

    return await this.formatUserResponse(updatedUser, false);
  }

  async listSessions(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const profile = await this.formatUserResponse(user, false);
    return profile.security;
  }

  async logoutSession(userId, sessionId) {
    if (!sessionId) return { success: true };

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const session = (user.auth?.sessions || []).find((item) => item.sessionId === sessionId);
    if (session) {
      session.revokedAt = new Date();
      await user.save();
    }

    return { success: true };
  }

  async revokeSession(userId, sessionId) {
    if (!sessionId) throw new ValidationError('Session id is required', 'sessionId');
    return this.logoutSession(userId, sessionId);
  }

  async requestEmailVerification(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const otp = this.createOtp();
    user.auth = user.auth || {};
    user.auth.emailVerification = {
      verified: Boolean(user.auth?.emailVerification?.verified),
      verifiedAt: user.auth?.emailVerification?.verifiedAt,
      otpHash: this.hashValue(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    };
    await user.save();

    const response = { message: 'Verification code generated.' };
    if (process.env.NODE_ENV !== 'production') response.otp = otp;
    return response;
  }

  async verifyEmail(userId, otp) {
    validateRequiredField(otp, 'OTP');

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const verification = user.auth?.emailVerification;
    if (!verification?.otpHash || !verification.expiresAt || verification.expiresAt < new Date()) {
      throw new ValidationError('Verification code expired. Request a new code.', 'otp');
    }

    if ((verification.attempts || 0) >= 5) {
      throw new ValidationError('Too many verification attempts. Request a new code.', 'otp');
    }

    verification.attempts = (verification.attempts || 0) + 1;
    if (this.hashValue(otp) !== verification.otpHash) {
      await user.save();
      throw new ValidationError('Invalid verification code', 'otp');
    }

    verification.verified = true;
    verification.verifiedAt = new Date();
    verification.otpHash = undefined;
    verification.expiresAt = undefined;
    await user.save();
    await SqlUserService.upsertFromMongoUser(user);

    return this.formatUserResponse(user, false);
  }

  async requestPasswordReset(email, context = {}) {
    validateRequiredField(email, 'Email');
    validateEmail(email);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return { message: 'If this email exists, a password reset token has been generated.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.auth = user.auth || {};
    user.auth.passwordReset = {
      tokenHash: this.hashValue(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: undefined,
    };
    user.auth.loginHistory = [
      {
        status: 'success',
        email: user.email,
        ...this.getClientContext(context),
        reason: 'Password reset requested',
      },
      ...(user.auth.loginHistory || []),
    ].slice(0, 50);
    await user.save();

    const response = { message: 'If this email exists, a password reset token has been generated.' };
    if (process.env.NODE_ENV !== 'production') response.resetToken = token;
    return response;
  }

  async resetPassword(token, password) {
    validateRequiredField(token, 'Reset token');
    validatePassword(password);

    const user = await User.findOne({
      'auth.passwordReset.tokenHash': this.hashValue(token),
      'auth.passwordReset.expiresAt': { $gt: new Date() },
    });

    if (!user || user.auth?.passwordReset?.usedAt) {
      throw new ValidationError('Invalid or expired reset token', 'token');
    }

    user.password = password;
    user.auth.passwordReset.usedAt = new Date();
    user.auth.sessions = [];
    await user.save();

    return { message: 'Password reset successful. Please login again.' };
  }

  /**
   * Update KYC status
   */
  async updateKYCStatus(userId, kycStatus) {
    if (!['pending', 'verified', 'rejected'].includes(kycStatus)) {
      throw new ValidationError('Invalid KYC status', 'kycStatus');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { kycStatus },
      { new: true }
    );
    await SqlUserService.upsertFromMongoUser(user);

    return await this.formatUserResponse(user);
  }

  /**
   * Add refresh token for device
   */
  async addRefreshToken(userId, token, deviceId, expiresAt) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.auth.refreshTokens.push({
      token,
      deviceId,
      expiresAt,
      createdAt: new Date(),
    });

    await user.save();
  }

  /**
   * Remove expired refresh tokens
   */
  async cleanupExpiredTokens(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.auth.refreshTokens = user.auth.refreshTokens.filter(
      (rt) => rt.expiresAt > new Date()
    );

    await user.save();
  }

  /**
   * Save generated QR code
   */
  async saveQRCode(userId, qrData) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.generatedQRCodes.push({
      upiAddress: qrData.upiAddress,
      amount: qrData.amount,
      note: qrData.note,
    });

    await user.save();
    return await this.formatUserResponse(user, false);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId, avatarPath) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oldAvatar = user.profile.avatar;

    user.profile.avatar = avatarPath;
    const updatedUser = await user.save();
    await SqlUserService.updateAvatarForMongoUser(
      updatedUser,
      avatarPath,
      CloudinaryStorageService.extractPublicIdFromUrl(avatarPath)
    );
    if (oldAvatar && oldAvatar !== avatarPath) {
      await require('./ProfileImageService').deleteProfileImage(oldAvatar);
    }

    return await this.formatUserResponse(updatedUser, false);
  }
}

module.exports = new UserService();
