const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['bank', 'wallet', 'upi'],
    required: true,
  },
  provider: {
    type: String, // 'HDFC', 'Paytm', 'GPay', 'Amazon Pay', etc.
    required: true,
  },
  balance: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  },
  accountNumber: {
    type: String,
  },
  upiId: {
    type: String,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  linkedOn: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Ensure unique account per user per provider
AccountSchema.index({ userId: 1, provider: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Account', AccountSchema);
