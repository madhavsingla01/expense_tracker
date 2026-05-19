const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  month: {
    type: String, // 'YYYY-MM'
    required: true,
  },
  totalIncome: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  totalExpenses: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  totalSavings: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  categoryExpenses: {
    type: Map,
    of: mongoose.Schema.Types.Decimal128,
    default: {},
  },
  netSavings: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Ensure one analytics document per user per month
AnalyticsSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', AnalyticsSchema);
