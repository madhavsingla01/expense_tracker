const asyncHandler = require('express-async-handler');
const { PaymentService } = require('../services');

const listPayments = asyncHandler(async (req, res) => {
  const payments = await PaymentService.listPayments(req.user._id, req.query.limit);
  res.status(200).json(payments);
});

const listIntentPayments = asyncHandler(async (req, res) => {
  const payments = await PaymentService.listIntentPayments(req.user._id, req.query.limit);
  res.status(200).json(payments);
});

const initiatePayment = asyncHandler(async (req, res) => {
  const result = await PaymentService.initiatePayment(req.user._id, req.body);
  res.status(201).json(result);
});

const initiateIntentPayment = asyncHandler(async (req, res) => {
  const result = await PaymentService.initiateUpiIntentPayment(req.user._id, req.body);
  res.status(201).json(result);
});

const confirmIntentPayment = asyncHandler(async (req, res) => {
  const payment = await PaymentService.confirmUpiIntentPayment(req.user._id, req.params.referenceId, req.body);
  res.status(200).json(payment);
});

const failIntentPayment = asyncHandler(async (req, res) => {
  const payment = await PaymentService.failUpiIntentPayment(req.user._id, req.params.referenceId, req.body);
  res.status(200).json(payment);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const payment = await PaymentService.verifyPayment(req.user._id, req.params.referenceId, req.body);
  res.status(200).json(payment);
});

const reconcilePayment = asyncHandler(async (req, res) => {
  const payment = await PaymentService.reconcilePayment(req.user._id, req.params.referenceId);
  res.status(200).json(payment);
});

const razorpayWebhook = asyncHandler(async (req, res) => {
  const result = await PaymentService.processRazorpayWebhook({
    rawBody: req.rawBody,
    signature: req.headers['x-razorpay-signature'],
    eventId: req.headers['x-razorpay-event-id'],
    payload: req.body,
  });

  res.status(200).json({
    received: true,
    duplicate: Boolean(result?.duplicate),
  });
});

module.exports = {
  listPayments,
  listIntentPayments,
  initiatePayment,
  initiateIntentPayment,
  confirmIntentPayment,
  failIntentPayment,
  verifyPayment,
  reconcilePayment,
  razorpayWebhook,
};
