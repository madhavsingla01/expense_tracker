const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: [true, 'Please add a message'],
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['general', 'bug', 'feature', 'payment', 'import', 'mobile', 'account', 'other'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed'],
    default: 'pending'
  },
  reviewedAt: {
    type: Date
  },
  metadata: {
    page: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  }
}, { timestamps: true });

FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ category: 1, createdAt: -1 });
FeedbackSchema.index({ message: 'text' });

module.exports = mongoose.model('Feedback', FeedbackSchema);
