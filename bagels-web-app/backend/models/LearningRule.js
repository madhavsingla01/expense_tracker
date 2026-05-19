const mongoose = require('mongoose');

const LearningRuleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  payeePattern: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  count: {
    type: Number,
    default: 1,
  },
}, { timestamps: true });

module.exports = mongoose.model('LearningRule', LearningRuleSchema);
