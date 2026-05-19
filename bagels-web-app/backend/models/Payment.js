const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Account',
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
  provider: {
    type: String,
    enum: ['razorpay'],
    default: 'razorpay',
  },
  referenceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  receiverUpi: {
    type: String,
    required: true,
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  note: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: 'General',
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'success', 'failed'],
    default: 'created',
  },
  gateway: {
    orderId: String,
    orderStatus: String,
    paymentId: String,
    paymentStatus: String,
    signature: String,
    checkoutVerifiedAt: Date,
    webhookReceivedAt: Date,
    webhookEventIds: {
      type: [String],
      default: [],
    },
    lastPayload: mongoose.Schema.Types.Mixed,
    lastResponse: mongoose.Schema.Types.Mixed,
    lastError: String,
  },
  reconciliation: {
    lastCheckedAt: Date,
    attempts: {
      type: Number,
      default: 0,
    },
    lastStatus: String,
    nextRetryAt: Date,
  },
  failure: {
    code: String,
    reason: String,
    recordedAt: Date,
  },
  settledAt: Date,
  settlementInProgress: {
    type: Boolean,
    default: false,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ 'gateway.orderId': 1 }, { unique: true, sparse: true });
PaymentSchema.index({ 'gateway.paymentId': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', PaymentSchema);
