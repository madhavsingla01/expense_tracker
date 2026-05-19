const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');

const allowedCategories = new Set(['general', 'bug', 'feature', 'payment', 'import', 'mobile', 'account', 'other']);

// @desc    Submit user feedback
// @route   POST /api/feedback
// @access  Private
const submitFeedback = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  const category = allowedCategories.has(req.body.category) ? req.body.category : 'general';

  if (!message) {
    res.status(400);
    throw new Error('Please add a message');
  }

  if (message.length > 2000) {
    res.status(400);
    throw new Error('Feedback must be 2000 characters or fewer');
  }

  const feedback = await Feedback.create({
    user: req.user._id,
    message,
    category,
    metadata: {
      page: String(req.body.page || '').slice(0, 160),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    },
  });

  res.status(201).json(feedback);
});

module.exports = { submitFeedback };
