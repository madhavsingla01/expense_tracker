const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ['expense', 'income', 'transfer'],
    required: true,
  },
  subType: {
    type: String,
    enum: ['upi', 'card', 'cash', 'bank', 'wallet'],
    default: 'cash',
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
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  vendorName: {
    type: String,
    required: true,
    // Original vendor name as entered by user
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    // Reference to deduplicated merchant
  },
  category: {
    type: String,
    required: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  splitGroupId: {
    type: String,
    default: '',
    index: true,
  },
  parentTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
  linkedTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  }],
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', null],
      default: null,
    },
    nextRunAt: Date,
    endAt: Date,
    templateId: String,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'unverified'],
    default: 'success',
  },
  source: {
    type: String,
    enum: ['manual', 'ocr', 'bank_sync', 'bank_statement', 'upi_intent'],
    default: 'manual',
  },
  receiptUrl: {
    type: String,
    default: '',
  },
  meta: {
    upiId: String,
    note: String,
    referenceId: String,
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    paymentAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentAttempt',
    },
    intentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled', 'unknown'],
      default: 'unknown',
    },
    txnId: String,
    responseCode: String,
    approvalRefNo: String,
    gateway: {
      provider: String,
      orderId: String,
      paymentId: String,
      paymentStatus: String,
      signature: String,
      webhookEventId: String,
    },
    rawResponse: mongoose.Schema.Types.Mixed,
    sourceRef: String,
    rawDescription: String,
    normalizedMerchant: String,
    dedupeKey: String,
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    importBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportBatch',
    },
    statementRow: Number,
    location: {
      latitude: mongoose.Schema.Types.Decimal128,
      longitude: mongoose.Schema.Types.Decimal128,
    }
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Strict validation rule: A transaction cannot have BOTH debit and credit > 0
TransactionSchema.pre('validate', function(next) {
  const d = this.debit ? parseFloat(this.debit.toString()) : 0;
  const c = this.credit ? parseFloat(this.credit.toString()) : 0;
  
  if (d > 0 && c > 0) {
    return next(new Error('A transaction must NEVER have both debit and credit.'));
  }
  
  if (this.type === 'expense' && c > 0) {
    return next(new Error('Expense transactions must use debit, not credit.'));
  }
  
  if (this.type === 'income' && d > 0) {
    return next(new Error('Income transactions must use credit, not debit.'));
  }
  
  next();
});

// Virtual for backward compatibility
TransactionSchema.virtual('amount').get(function() {
  const d = this.debit ? parseFloat(this.debit.toString()) : 0;
  const c = this.credit ? parseFloat(this.credit.toString()) : 0;
  return d > 0 ? d : c;
});

TransactionSchema.set('toJSON', { virtuals: true });
TransactionSchema.set('toObject', { virtuals: true });

TransactionSchema.index({ userId: 1, status: 1, date: -1 });
TransactionSchema.index({ userId: 1, 'meta.dedupeKey': 1 });
TransactionSchema.index({ userId: 1, source: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, accountId: 1, date: -1 });
TransactionSchema.index({ userId: 1, category: 1, date: -1 });
TransactionSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
