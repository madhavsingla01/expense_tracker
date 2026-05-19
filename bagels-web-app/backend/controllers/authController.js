const asyncHandler = require('express-async-handler');
const { UserService, ValidationService } = require('../services');
const AccountDeletionService = require('../services/AccountDeletionService');
const ProfileImageService = require('../services/ProfileImageService');

function getAuthContext(req) {
  return {
    ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'] || '',
    deviceName: req.headers['x-device-name'] || '',
  };
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const result = await UserService.registerUser(req.body, getAuthContext(req));
  res.status(201).json(result);
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await UserService.loginUser(email, password, getAuthContext(req));
  res.json(result);
});

// @desc    Logout current session
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
  const result = await UserService.logoutSession(req.user._id, req.auth?.sessionId);
  res.json(result);
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const result = await UserService.getUserProfile(req.user._id);
  res.json(result);
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const result = await UserService.updateUserProfile(req.user._id, req.body);
  res.json(result);
});

const getSessions = asyncHandler(async (req, res) => {
  const result = await UserService.listSessions(req.user._id);
  res.json(result);
});

const revokeSession = asyncHandler(async (req, res) => {
  const result = await UserService.revokeSession(req.user._id, req.params.sessionId);
  res.json(result);
});

const requestEmailVerification = asyncHandler(async (req, res) => {
  const result = await UserService.requestEmailVerification(req.user._id);
  res.json(result);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await UserService.verifyEmail(req.user._id, req.body.otp);
  res.json(result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await UserService.requestPasswordReset(req.body.email, getAuthContext(req));
  res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await UserService.resetPassword(req.body.token, req.body.password);
  res.json(result);
});

// @desc    Save generated QR code
// @route   POST /api/auth/qr
// @access  Private
const saveQRCode = asyncHandler(async (req, res) => {
  const result = await UserService.saveQRCode(req.user._id, req.body);
  res.json(result);
});

// @desc    Preview what will be deleted
// @route   GET /api/auth/delete-preview
// @access  Private
const getDeletionPreview = asyncHandler(async (req, res) => {
  const preview = await AccountDeletionService.getDeletionPreview(req.user._id);
  res.json(preview);
});

// @desc    Permanently delete user account and all data
// @route   POST /api/auth/delete-account
// @access  Private
const deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmText } = req.body;

  if (!password) {
    res.status(400);
    throw new Error('Password is required to delete your account');
  }

  if (confirmText !== 'DELETE MY ACCOUNT') {
    res.status(400);
    throw new Error('Please type "DELETE MY ACCOUNT" to confirm');
  }

  try {
    const report = await AccountDeletionService.deleteAccount(req.user._id, password);
    res.json({
      message: 'Account permanently deleted',
      report,
    });
  } catch (error) {
    if (error.message === 'Incorrect password') {
      res.status(401);
      throw new Error('Incorrect password. Account deletion aborted.');
    }
    throw error;
  }
});

// @desc    Upload profile avatar
// @route   POST /api/auth/profile/avatar
// @access  Private
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload an image file');
  }

  const avatarPath = await ProfileImageService.optimizeProfileImage(req.user, req.file);
  try {
    const result = await UserService.updateAvatar(req.user._id, avatarPath);
    res.json(result);
  } catch (error) {
    await ProfileImageService.deleteProfileImage(avatarPath);
    throw error;
  }
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getSessions,
  revokeSession,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  uploadAvatar,
  saveQRCode,
  deleteAccount,
  getDeletionPreview,
};
