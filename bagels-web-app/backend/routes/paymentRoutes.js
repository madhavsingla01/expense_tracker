const express = require('express');
const router = express.Router();
const {
  listPayments,
  listIntentPayments,
  initiatePayment,
  initiateIntentPayment,
  confirmIntentPayment,
  failIntentPayment,
  verifyPayment,
  reconcilePayment,
  razorpayWebhook,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/webhooks/razorpay', razorpayWebhook);
router.get('/intent', protect, listIntentPayments);
router.post('/intent/initiate', protect, initiateIntentPayment);
router.post('/intent/:referenceId/confirm', protect, confirmIntentPayment);
router.post('/intent/:referenceId/fail', protect, failIntentPayment);
router.get('/', protect, listPayments);
router.post('/initiate', protect, initiatePayment);
router.post('/:referenceId/verify', protect, verifyPayment);
router.post('/:referenceId/reconcile', protect, reconcilePayment);

module.exports = router;
