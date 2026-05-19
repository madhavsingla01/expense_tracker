const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  notificationType: {
    type: String, // 'Spending Alert', 'Bill Reminder'
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String, // 'Sent', 'Read', 'Pending'
    default: 'Pending',
  },
  sentAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Notification', NotificationSchema);
