const asyncHandler = require('express-async-handler');
const IntelligenceService = require('../services/IntelligenceService');
const MerchantService = require('../services/MerchantService');

// @desc    Predict category with confidence + suggestions for a payee
// @route   GET /api/predict
// @access  Private
const predictCategory = asyncHandler(async (req, res) => {
  const { payee } = req.query;
  const result = await IntelligenceService.getSuggestions(req.user._id, payee);
  res.status(200).json(result);
});

const merchantSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await MerchantService.getSmartSuggestions(
    req.user._id,
    String(req.query.q || ''),
    req.query.limit
  );
  res.status(200).json(suggestions);
});

module.exports = { predictCategory, merchantSuggestions };
