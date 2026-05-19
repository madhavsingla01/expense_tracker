const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
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
  },
  entryType: {
    type: String,
    enum: ['normal', 'reversal', 'correction'],
    default: 'normal',
    required: true,
  },
  debit: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  credit: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  balanceAfter: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  description: {
    type: String,
  },
  reference: {
    type: String,
  },
  source: {
    type: String,
    default: 'transaction',
  },
  currency: {
    type: String,
    default: 'INR',
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Index for fast balance lookups and account reconciliation
LedgerSchema.index({ userId: 1, accountId: 1, createdAt: -1 });
LedgerSchema.index({ accountId: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', LedgerSchema);
