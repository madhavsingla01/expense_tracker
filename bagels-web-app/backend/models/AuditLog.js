const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  action: {
    type: String,
    required: true,
    // e.g., 'DELETE_TRANSACTION', 'UPDATE_BUDGET', 'LINK_ACCOUNT', 'LOGIN', etc.
  },
  resourceType: {
    type: String,
    // 'transaction', 'budget', 'account', 'user', etc.
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  ip: {
    type: String,
  },
  device: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    default: 'success',
  },
  errorMessage: {
    type: String,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

// Index for audit trail lookups
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
