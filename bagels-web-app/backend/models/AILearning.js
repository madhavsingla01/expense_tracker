const mongoose = require('mongoose');

const AILearningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  input: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  predictedCategory: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },
  timesUsed: {
    type: Number,
    default: 1,
  },
  lastUsedAt: {
    type: Date,
  },
  correct: {
    type: Boolean,
    default: null,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Unique per user per input pattern
AILearningSchema.index({ userId: 1, input: 1 }, { unique: true });

module.exports = mongoose.model('AILearning', AILearningSchema);
