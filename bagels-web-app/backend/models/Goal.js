const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  goalName: {
    type: String,
    required: true,
  },
  targetAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  currentAmount: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  targetDate: {
    type: Date,
    required: true,
  },
  progress: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  status: {
    type: String, // 'Active', 'Completed', 'Paused'
    default: 'Active',
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Goal', GoalSchema);
