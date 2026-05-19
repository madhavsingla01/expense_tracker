const mongoose = require('mongoose');

const PaymentAttemptSchema = new mongoose.Schema({
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
    enum: ['initiated', 'success', 'failed'],
    default: 'initiated',
  },
  intentStatus: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled', 'unknown'],
    default: 'pending',
  },
  upiLink: {
    type: String,
    required: true,
  },
  rawResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  parsedResponse: {
    rawStatus: String,
    txnId: String,
    responseCode: String,
    approvalRefNo: String,
  },
  manualConfirmation: {
    completed: Boolean,
    confirmedAt: Date,
    source: {
      type: String,
      default: 'user',
    },
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

PaymentAttemptSchema.index({ userId: 1, createdAt: -1 });
PaymentAttemptSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
