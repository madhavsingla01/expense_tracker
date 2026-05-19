const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  passwordHash: {
    type: String,
  },
  auth: {
    refreshTokens: [{
      token: String,
      deviceId: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now }
    }],
    devices: [{
      deviceId: String,
      deviceName: String,
      osType: String,
      lastLoginAt: Date,
      ipAddress: String
    }],
    sessions: [{
      sessionId: { type: String, required: true },
      tokenHash: { type: String, required: true },
      deviceName: { type: String, default: 'Unknown device' },
      osType: { type: String, default: 'Unknown OS' },
      browser: { type: String, default: 'Unknown browser' },
      ipAddress: String,
      userAgent: String,
      suspicious: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      lastSeenAt: { type: Date, default: Date.now },
      expiresAt: Date,
      revokedAt: Date,
    }],
    loginHistory: [{
      status: {
        type: String,
        enum: ['success', 'failure'],
        required: true,
      },
      email: String,
      ipAddress: String,
      userAgent: String,
      deviceName: String,
      osType: String,
      browser: String,
      suspicious: { type: Boolean, default: false },
      reason: String,
      createdAt: { type: Date, default: Date.now },
    }],
    emailVerification: {
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      otpHash: String,
      expiresAt: Date,
      attempts: { type: Number, default: 0 },
    },
    phoneVerification: {
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      otpHash: String,
      expiresAt: Date,
      attempts: { type: Number, default: 0 },
    },
    passwordReset: {
      tokenHash: String,
      expiresAt: Date,
      usedAt: Date,
    },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  profile: {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    dateOfBirth: { type: Date },
    avatar: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' },
    bio: { type: String, default: '', maxlength: 300 },
    occupation: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      postalCode: { type: String, default: '' },
    },
    preferredLanguage: { type: String, default: 'en' },
    timezone: { type: String, default: '' },
  },
  preferences: {
    notificationEnabled: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: true },
  },
  generatedQRCodes: [{
    upiAddress: String,
    amount: Number,
    note: String,
    createdAt: { type: Date, default: Date.now }
  }],
  savedContacts: [{
    name: { type: String, required: true },
    upiId: { type: String, required: true }
  }],
  spendingCategories: {
    type: [String],
    default: [
      'Groceries', 'Entertainment', 'Utilities', 'Transport',
      'Food & Dining', 'Shopping', 'Subscriptions', 'Travel',
      'Healthcare', 'Education', 'Rent', 'General'
    ]
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

UserSchema.index({ 'auth.sessions.sessionId': 1 });
UserSchema.index({ 'auth.passwordReset.tokenHash': 1 }, { sparse: true });

// Virtual for password to trigger hash
UserSchema.virtual('password')
  .set(function(password) {
    this._password = password;
  })
  .get(function() {
    return this._password;
  });

UserSchema.pre('save', async function (next) {
  if (this._password) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this._password, salt);
  }
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
