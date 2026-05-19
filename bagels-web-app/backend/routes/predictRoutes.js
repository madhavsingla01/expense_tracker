const express = require('express');
const router = express.Router();
const { predictCategory, merchantSuggestions } = require('../controllers/predictController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, predictCategory);
router.get('/merchants', protect, merchantSuggestions);

module.exports = router;
