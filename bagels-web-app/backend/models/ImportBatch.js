const mongoose = require('mongoose');

const ImportRowSchema = new mongoose.Schema({
  rowNumber: Number,
  date: Date,
  amount: mongoose.Schema.Types.Decimal128,
  type: {
    type: String,
    enum: ['expense', 'income'],
    default: 'expense',
  },
  rawDescription: String,
  merchantName: String,
  normalizedMerchant: String,
  category: String,
  status: {
    type: String,
    enum: ['created', 'duplicate', 'failed', 'skipped'],
    default: 'skipped',
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  duplicateTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  error: String,
}, { _id: false });

const ImportBatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
  },
  source: {
    type: String,
    enum: ['bank_statement'],
    default: 'bank_statement',
  },
  fileName: {
    type: String,
    required: true,
  },
  fileType: String,
  parser: String,
  mapping: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  file: {
    storage: { type: String, default: 'memory' },
    size: Number,
    checksum: String,
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'reverted'],
    default: 'processing',
  },
  summary: {
    parsed: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },
  rows: {
    type: [ImportRowSchema],
    default: [],
  },
  warnings: {
    type: [String],
    default: [],
  },
  errorMessage: String,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

ImportBatchSchema.index({ userId: 1, createdAt: -1 });
ImportBatchSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ImportBatch', ImportBatchSchema);
