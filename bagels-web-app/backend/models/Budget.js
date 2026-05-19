const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  category: {
    type: String,
    required: true,
  },
  budgetAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  spent: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  remaining: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  alertEnabled: {
    type: Boolean,
    default: true,
  },
  alerts: [{
    percent: {
      type: Number,
      required: true,
    },
    triggered: {
      type: Boolean,
      default: false,
    },
    triggeredAt: Date,
  }],
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Ensure unique budget per category per user
BudgetSchema.index({ userId: 1, category: 1, startDate: 1, endDate: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
