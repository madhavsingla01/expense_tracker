const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authRateLimit } = require('../middleware/securityMiddleware');
const upload = require('../middleware/uploadMiddleware');
router.post('/register', authRateLimit, registerUser);
router.post('/login', authRateLimit, loginUser);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);
router.post('/logout', protect, logoutUser);
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);
router.post('/profile/avatar', protect, upload.single('avatar'), uploadAvatar);
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);
router.post('/verify-email/request', protect, authRateLimit, requestEmailVerification);
router.post('/verify-email/confirm', protect, authRateLimit, verifyEmail);
router.post('/qr', protect, saveQRCode);

// Account deletion
router.get('/delete-preview', protect, getDeletionPreview);
router.post('/delete-account', protect, deleteAccount);

module.exports = router;
