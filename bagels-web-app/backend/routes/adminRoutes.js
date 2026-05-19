const express = require('express');
const {
  getDashboard,
  listUsers,
  getUserDetails,
  listTransactions,
  listMerchants,
  updateMerchant,
  listAi,
  listOcr,
  listImports,
  listLogs,
  listFeedback,
  reviewFeedback,
} = require('../controllers/adminController');
const { adminBasicAuth } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.use(adminBasicAuth);

router.get('/', getDashboard);
router.get('/users', listUsers);
router.get('/users/:userId', getUserDetails);
router.get('/transactions', listTransactions);
router.get('/merchants', listMerchants);
router.post('/merchants/:merchantId', updateMerchant);
router.get('/ai', listAi);
router.get('/ocr', listOcr);
router.get('/imports', listImports);
router.get('/logs', listLogs);
router.get('/feedback', listFeedback);
router.post('/feedback/:id/review', reviewFeedback);

module.exports = router;
