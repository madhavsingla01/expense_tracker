const mongoose = require('mongoose');

const MerchantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  normalizedName: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  alternateNames: [{
    type: String,
  }],
  logo: {
    type: String,
  },
  website: {
    type: String,
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Merchant', MerchantSchema);
