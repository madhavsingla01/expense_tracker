const crypto = require('crypto');
const https = require('https');
const Payment = require('../models/Payment');
const PaymentAttempt = require('../models/PaymentAttempt');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const AccountService = require('./AccountService');
const TransactionService = require('./TransactionService');
const TransactionIngestionService = require('./TransactionIngestionService');
const IntelligenceService = require('./IntelligenceService');
const { broadcastPaymentUpdate, broadcastTransactionChange } = require('../utils/paymentSocketServer');
const {
  ValidationError,
  validateAmount,
  validateRequiredField,
} = require('./ValidationService');

class PaymentService {
  toNumber(decimalValue) {
    if (decimalValue === null || decimalValue === undefined) return 0;
    return parseFloat(decimalValue.toString());
  }

  toMinorUnits(value) {
    return Math.round(this.toNumber(value) * 100);
  }

  toPlainObject(value) {
    if (!value) return {};
    if (typeof value.toObject === 'function') return value.toObject();
    return { ...value };
  }

  createReferenceId() {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PAY${stamp}${suffix}`;
  }

  parseGatewayTimestamp(value) {
    if (!value) return new Date();
    if (typeof value === 'number') {
      return new Date(String(value).length <= 10 ? value * 1000 : value);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  appendUnique(items = [], nextItem) {
    if (!nextItem) return items;
    return Array.from(new Set([...(items || []), nextItem]));
  }

  getGatewayConfig({ requireWebhookSecret = false } = {}) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!keyId || !keySecret) {
      throw new ValidationError(
        'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.',
        'gateway'
      );
    }

    if (requireWebhookSecret && !webhookSecret) {
      throw new ValidationError(
        'Razorpay webhook secret is missing. Add RAZORPAY_WEBHOOK_SECRET in backend/.env.',
        'gateway'
      );
    }

    return {
      keyId,
      keySecret,
      webhookSecret,
      accountName: process.env.RAZORPAY_ACCOUNT_NAME || 'CASH CLAIR',
      themeColor: process.env.RAZORPAY_THEME_COLOR || '#10b981',
    };
  }

  async requestRazorpay(path, { method = 'GET', body } = {}) {
    const { keyId, keySecret } = this.getGatewayConfig();
    const payload = body ? JSON.stringify(body) : null;

    return new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'api.razorpay.com',
        path,
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          Accept: 'application/json',
          ...(payload ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          } : {}),
        },
      }, (response) => {
        let raw = '';
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => {
          let parsed = {};

          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              reject(new Error('Invalid Razorpay response payload'));
              return;
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          const message = parsed?.error?.description
            || parsed?.error?.reason
            || parsed?.error?.code
            || `Razorpay request failed with status ${response.statusCode}`;

          reject(new Error(message));
        });
      });

      request.on('error', reject);
      if (payload) {
        request.write(payload);
      }
      request.end();
    });
  }

  timingSafeEqual(first, second) {
    const left = Buffer.from(String(first || ''));
    const right = Buffer.from(String(second || ''));

    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  verifyCheckoutSignature(orderId, paymentId, signature) {
    const { keySecret } = this.getGatewayConfig();
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (!this.timingSafeEqual(expected, signature)) {
      throw new ValidationError('Invalid Razorpay checkout signature', 'signature');
    }
  }

  verifyWebhookSignature(rawBody, signature) {
    const { webhookSecret } = this.getGatewayConfig({ requireWebhookSecret: true });
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!this.timingSafeEqual(expected, signature)) {
      throw new ValidationError('Invalid Razorpay webhook signature', 'signature');
    }
  }

  mapGatewayStatus(rawStatus) {
    const status = String(rawStatus || '').trim().toLowerCase();

    if (['captured', 'paid', 'success'].includes(status)) return 'success';
    if (['failed', 'cancelled', 'canceled', 'expired'].includes(status)) return 'failed';
    if (['created', 'authorized', 'attempted', 'pending'].includes(status)) return 'pending';

    return 'pending';
  }

  assertAmountMatches(payment, amountInMinorUnits) {
    const expected = this.toMinorUnits(payment.amount);
    if (Number(amountInMinorUnits) !== expected) {
      throw new ValidationError('Gateway amount does not match the payment amount', 'amount');
    }
  }

  buildCheckoutConfig(payment) {
    const { keyId, accountName, themeColor } = this.getGatewayConfig();

    return {
      provider: 'razorpay',
      keyId,
      orderId: payment.gateway?.orderId || '',
      amount: this.toMinorUnits(payment.amount),
      currency: payment.currency || 'INR',
      name: accountName,
      description: `Gateway payment for ${payment.receiverUpi}`,
      notes: {
        referenceId: payment.referenceId,
        receiverUpi: payment.receiverUpi,
        note: payment.note || '',
      },
      themeColor,
    };
  }

  formatPaymentResponse(payment) {
    const linkedTransaction = payment?.transactionId && typeof payment.transactionId === 'object'
      ? payment.transactionId
      : null;

    return {
      _id: payment._id,
      id: payment._id,
      referenceId: payment.referenceId,
      provider: payment.provider,
      transactionId: linkedTransaction?._id || payment.transactionId || null,
      transactionStatus: linkedTransaction?.status || null,
      receiverUpi: payment.receiverUpi,
      amount: this.toNumber(payment.amount),
      currency: payment.currency || 'INR',
      note: payment.note || '',
      category: payment.category || 'General',
      status: payment.status,
      gatewayStatus: payment.gateway?.paymentStatus || payment.gateway?.orderStatus || payment.status,
      gatewayOrderId: payment.gateway?.orderId || '',
      gatewayPaymentId: payment.gateway?.paymentId || '',
      failedReason: payment.failure?.reason || '',
      settledAt: payment.settledAt || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      canResume: payment.status === 'pending' && Boolean(payment.gateway?.orderId),
      canReconcile: payment.status === 'pending' && Boolean(payment.gateway?.orderId),
      checkout: payment.status === 'pending' && payment.gateway?.orderId
        ? this.buildCheckoutConfig(payment)
        : null,
    };
  }

  async emitPaymentUpdate(paymentId) {
    const payment = await Payment.findById(paymentId).populate('transactionId');
    if (!payment) return null;

    const formatted = this.formatPaymentResponse(payment);
    broadcastPaymentUpdate(payment.userId, formatted);
    return formatted;
  }

  async getPaymentDocument(userId, referenceId) {
    const payment = await Payment.findOne({ userId, referenceId }).populate('transactionId');
    if (!payment) {
      throw new Error('Payment not found');
    }
    return payment;
  }

  async listPayments(userId, limit = 12) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 12;

    const payments = await Payment.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .populate('transactionId')
      .lean();

    return payments.map((payment) => this.formatPaymentResponse(payment));
  }

  buildUpiIntentLink({ receiverUpi, amount, note, referenceId }) {
    const params = new URLSearchParams({
      pa: receiverUpi,
      pn: 'CASH CLAIR',
      am: this.toNumber(amount).toFixed(2),
      cu: 'INR',
      tr: referenceId,
    });

    const trimmedNote = String(note || '').trim();
    if (trimmedNote) {
      params.set('tn', trimmedNote.slice(0, 80));
    }

    return `upi://pay?${params.toString()}`;
  }

  formatIntentAttempt(attempt) {
    return {
      _id: attempt._id,
      id: attempt._id,
      provider: 'upi_intent',
      referenceId: attempt.referenceId,
      transactionId: attempt.transactionId || null,
      receiverUpi: attempt.receiverUpi,
      amount: this.toNumber(attempt.amount),
      currency: 'INR',
      note: attempt.note || '',
      category: attempt.category || 'General',
      status: attempt.status,
      intentStatus: attempt.intentStatus,
      upiLink: attempt.upiLink,
      canResume: attempt.status === 'initiated',
      rawResponse: attempt.rawResponse || null,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  async listIntentPayments(userId, limit = 12) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 12;

    const attempts = await PaymentAttempt.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return attempts.map((attempt) => this.formatIntentAttempt(attempt));
  }

  async initiateUpiIntentPayment(userId, { receiverUpi, amount, note }) {
    validateRequiredField(receiverUpi, 'receiver_upi');

    if (!/.+@.+/.test(receiverUpi)) {
      throw new ValidationError('Invalid UPI address. Use format: name@bank', 'receiver_upi');
    }

    const validatedAmount = validateAmount(amount);
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    const primaryAccount = await AccountService.getPrimaryAccount(userId);
    const prediction = await IntelligenceService
      .predictCategory(userId, receiverUpi)
      .catch(() => ({ category: 'General' }));
    const referenceId = this.createReferenceId();
    const upiLink = this.buildUpiIntentLink({
      receiverUpi: receiverUpi.trim(),
      amount: validatedAmount,
      note: trimmedNote,
      referenceId,
    });

    const attempt = await PaymentAttempt.create({
      userId,
      accountId: primaryAccount._id,
      referenceId,
      receiverUpi: receiverUpi.trim(),
      amount: validatedAmount,
      note: trimmedNote,
      category: prediction?.category || 'General',
      status: 'initiated',
      intentStatus: 'pending',
      upiLink,
    });

    await AuditLog.create({
      userId,
      action: 'INITIATE_UPI_INTENT',
      resourceType: 'payment_attempt',
      resourceId: attempt._id,
      newValue: {
        referenceId,
        receiverUpi: attempt.receiverUpi,
        amount: validatedAmount,
      },
      status: 'success',
    });

    return {
      referenceId,
      payment: this.formatIntentAttempt(attempt),
    };
  }

  async confirmUpiIntentPayment(userId, referenceId, payload = {}) {
    const attempt = await PaymentAttempt.findOne({ userId, referenceId });
    if (!attempt) {
      throw new Error('Payment attempt not found');
    }

    if (attempt.status === 'success' && attempt.transactionId) {
      return this.formatIntentAttempt(attempt);
    }

    const result = await TransactionIngestionService.ingestOne(
      userId,
      attempt.accountId,
      {
        payee: attempt.receiverUpi,
        amount: this.toNumber(attempt.amount),
        date: new Date(),
        type: 'expense',
        subType: 'upi',
        category: attempt.category || 'General',
        source: 'upi_intent',
        status: 'unverified',
        notes: attempt.note || 'UPI intent manually confirmed by user',
        sourceRef: attempt.referenceId,
        meta: {
          referenceId: attempt.referenceId,
          paymentAttemptId: attempt._id,
          upiId: attempt.receiverUpi,
          intentStatus: 'success',
          rawResponse: payload,
        },
      },
      {
        source: 'upi_intent',
        dedupeMode: 'force',
      }
    );

    if (result.status === 'created') {
      attempt.transactionId = result.transaction.id || result.transaction._id;
    } else if (result.status === 'duplicate') {
      attempt.transactionId = result.duplicateTransactionId;
    }

    attempt.status = 'success';
    attempt.intentStatus = 'success';
    attempt.rawResponse = {
      ...payload,
      duplicate: result.status === 'duplicate',
    };
    attempt.manualConfirmation = {
      completed: true,
      confirmedAt: new Date(),
      source: 'user',
    };
    await attempt.save();

    await AuditLog.create({
      userId,
      action: 'CONFIRM_UPI_INTENT',
      resourceType: 'payment_attempt',
      resourceId: attempt._id,
      newValue: {
        referenceId: attempt.referenceId,
        transactionId: attempt.transactionId,
        result: result.status,
      },
      status: 'success',
    });

    if (result.status === 'created') {
      broadcastTransactionChange(userId, {
        action: 'created',
        transactionId: result.transaction.id || result.transaction._id,
        transaction: result.transaction,
        source: 'upi_intent',
      });
    }

    return this.formatIntentAttempt(attempt);
  }

  async failUpiIntentPayment(userId, referenceId, payload = {}) {
    const attempt = await PaymentAttempt.findOne({ userId, referenceId });
    if (!attempt) {
      throw new Error('Payment attempt not found');
    }

    if (attempt.status === 'success') {
      return this.formatIntentAttempt(attempt);
    }

    attempt.status = 'failed';
    attempt.intentStatus = payload.intentStatus || 'failed';
    attempt.rawResponse = payload || null;
    await attempt.save();

    await AuditLog.create({
      userId,
      action: 'FAIL_UPI_INTENT',
      resourceType: 'payment_attempt',
      resourceId: attempt._id,
      newValue: {
        referenceId: attempt.referenceId,
        reason: payload.reason || 'User marked payment as failed',
      },
      status: 'success',
    });

    return this.formatIntentAttempt(attempt);
  }

  async initiatePayment(userId, { receiverUpi, amount, note }) {
    validateRequiredField(receiverUpi, 'receiver_upi');

    if (!/.+@.+/.test(receiverUpi)) {
      throw new ValidationError('Invalid UPI address. Use format: name@bank', 'receiver_upi');
    }

    const validatedAmount = validateAmount(amount);
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    const primaryAccount = await AccountService.getPrimaryAccount(userId);
    const prediction = await IntelligenceService
      .predictCategory(userId, receiverUpi)
      .catch(() => ({ category: 'General' }));

    const payment = await Payment.create({
      userId,
      accountId: primaryAccount._id,
      provider: 'razorpay',
      referenceId: this.createReferenceId(),
      receiverUpi: receiverUpi.trim(),
      amount: validatedAmount,
      currency: 'INR',
      note: trimmedNote,
      category: prediction?.category || 'General',
      status: 'created',
    });

    try {
      const order = await this.requestRazorpay('/v1/orders', {
        method: 'POST',
        body: {
          amount: this.toMinorUnits(validatedAmount),
          currency: 'INR',
          receipt: payment.referenceId,
          notes: {
            referenceId: payment.referenceId,
            receiverUpi: payment.receiverUpi,
            userId: String(userId),
            category: payment.category,
            note: trimmedNote.slice(0, 80),
          },
        },
      });

      payment.status = 'pending';
      payment.gateway = {
        ...this.toPlainObject(payment.gateway),
        orderId: order.id,
        orderStatus: order.status,
        lastResponse: order,
      };
      await payment.save();

      await AuditLog.create({
        userId,
        action: 'INITIATE_GATEWAY_PAYMENT',
        resourceType: 'payment',
        resourceId: payment._id,
        newValue: {
          referenceId: payment.referenceId,
          gatewayOrderId: order.id,
          receiverUpi: payment.receiverUpi,
          amount: validatedAmount,
        },
        status: 'success',
      });

      const formatted = await this.emitPaymentUpdate(payment._id);
      return {
        referenceId: payment.referenceId,
        payment: formatted,
      };
    } catch (error) {
      payment.status = 'failed';
      payment.failure = {
        reason: error.message,
        recordedAt: new Date(),
      };
      payment.gateway = {
        ...this.toPlainObject(payment.gateway),
        lastError: error.message,
      };
      await payment.save();
      await this.emitPaymentUpdate(payment._id);
      throw error;
    }
  }

  async createSettledTransaction(payment, gatewayPayment, context = {}) {
    let transaction = null;

    try {
      const created = await TransactionService.createTransaction(payment.userId, payment.accountId, {
        type: 'expense',
        subType: 'upi',
        amount: payment.amount,
        payee: payment.receiverUpi,
        category: payment.category || 'General',
        date: this.parseGatewayTimestamp(gatewayPayment?.captured_at || gatewayPayment?.created_at),
        status: 'success',
        source: 'payment',
        notes: payment.note || '',
        meta: {
          upiId: payment.receiverUpi,
          referenceId: payment.referenceId,
          paymentId: payment._id,
          txnId: gatewayPayment?.id || '',
          gateway: {
            provider: 'razorpay',
            orderId: payment.gateway?.orderId || gatewayPayment?.order_id || '',
            paymentId: gatewayPayment?.id || '',
            paymentStatus: gatewayPayment?.status || 'captured',
            signature: context.signature || '',
            webhookEventId: context.eventId || '',
          },
          rawResponse: gatewayPayment || null,
        },
      });
      transaction = await Transaction.findById(created.id || created._id);
    } catch (error) {
      throw error;
    }

    try {
      await Notification.create({
        userId: payment.userId,
        notificationType: 'Payment Settled',
        message: `Payment of Rs ${this.toNumber(payment.amount).toFixed(2)} to ${payment.receiverUpi} settled successfully.`,
        status: 'Sent',
        sentAt: new Date(),
      });
    } catch (error) {
      console.error('Payment notification creation failed:', error.message);
    }

    return transaction;
  }

  async finalizeSuccessfulPayment(paymentDoc, gatewayPayment, context = {}) {
    const payment = await Payment.findById(paymentDoc._id).populate('transactionId');
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'success' && payment.transactionId) {
      return this.formatPaymentResponse(payment);
    }

    if (gatewayPayment?.amount !== undefined) {
      this.assertAmountMatches(payment, gatewayPayment.amount);
    }

    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $ne: 'success' },
        settlementInProgress: { $ne: true },
      },
      {
        $set: { settlementInProgress: true },
      },
      { new: true }
    );

    if (!claimedPayment) {
      const latest = await Payment.findById(payment._id).populate('transactionId');
      return this.formatPaymentResponse(latest);
    }

    try {
      let transaction = claimedPayment.transactionId
        ? await Transaction.findById(claimedPayment.transactionId)
        : null;

      if (!transaction) {
        transaction = await Transaction.findOne({ 'meta.paymentId': claimedPayment._id });
      }

      if (!transaction) {
        transaction = await this.createSettledTransaction(claimedPayment, gatewayPayment, context);
      }

      claimedPayment.transactionId = transaction._id;
      claimedPayment.status = 'success';
      claimedPayment.settledAt = new Date();
      claimedPayment.settlementInProgress = false;
      claimedPayment.failure = undefined;
      claimedPayment.gateway = {
        ...this.toPlainObject(claimedPayment.gateway),
        orderId: claimedPayment.gateway?.orderId || gatewayPayment?.order_id || '',
        orderStatus: claimedPayment.gateway?.orderStatus || 'paid',
        paymentId: gatewayPayment?.id || claimedPayment.gateway?.paymentId || '',
        paymentStatus: gatewayPayment?.status || claimedPayment.gateway?.paymentStatus || 'captured',
        signature: context.signature || claimedPayment.gateway?.signature || '',
        checkoutVerifiedAt: context.source === 'checkout' ? new Date() : claimedPayment.gateway?.checkoutVerifiedAt,
        webhookReceivedAt: context.source === 'webhook' ? new Date() : claimedPayment.gateway?.webhookReceivedAt,
        webhookEventIds: this.appendUnique(claimedPayment.gateway?.webhookEventIds, context.eventId),
        lastPayload: gatewayPayment || claimedPayment.gateway?.lastPayload || null,
      };
      claimedPayment.reconciliation = {
        ...this.toPlainObject(claimedPayment.reconciliation),
        lastCheckedAt: new Date(),
        attempts: claimedPayment.reconciliation?.attempts || 0,
        lastStatus: 'success',
      };
      await claimedPayment.save();

      await AuditLog.create({
        userId: claimedPayment.userId,
        action: 'SETTLE_GATEWAY_PAYMENT_SUCCESS',
        resourceType: 'payment',
        resourceId: claimedPayment._id,
        newValue: {
          referenceId: claimedPayment.referenceId,
          gatewayOrderId: claimedPayment.gateway?.orderId,
          gatewayPaymentId: claimedPayment.gateway?.paymentId,
          transactionId: transaction._id,
        },
        status: 'success',
      });

      broadcastTransactionChange(claimedPayment.userId, {
        action: 'created',
        transactionId: transaction._id,
        transaction: TransactionService.formatTransactionResponse(transaction),
        source: 'payment',
      });
    } catch (error) {
      await Payment.findByIdAndUpdate(claimedPayment._id, {
        settlementInProgress: false,
      });
      throw error;
    }

    return this.emitPaymentUpdate(claimedPayment._id);
  }

  async markPaymentFailed(paymentDoc, details = {}, context = {}) {
    const payment = await Payment.findById(paymentDoc._id).populate('transactionId');
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'success') {
      return this.formatPaymentResponse(payment);
    }

    payment.status = 'failed';
    payment.settlementInProgress = false;
    payment.failure = {
      code: String(details.error_code || details.code || details.reason || ''),
      reason: context.reason
        || details.error_description
        || details.description
        || details.status
        || 'Payment failed',
      recordedAt: new Date(),
    };
    payment.gateway = {
      ...this.toPlainObject(payment.gateway),
      orderId: payment.gateway?.orderId || details.order_id || '',
      paymentId: details.id || payment.gateway?.paymentId || '',
      paymentStatus: details.status || payment.gateway?.paymentStatus || 'failed',
      webhookReceivedAt: context.source === 'webhook' ? new Date() : payment.gateway?.webhookReceivedAt,
      webhookEventIds: this.appendUnique(payment.gateway?.webhookEventIds, context.eventId),
      lastPayload: details || payment.gateway?.lastPayload || null,
    };
    payment.reconciliation = {
      ...this.toPlainObject(payment.reconciliation),
      lastCheckedAt: new Date(),
      attempts: payment.reconciliation?.attempts || 0,
      lastStatus: 'failed',
    };
    await payment.save();

    await AuditLog.create({
      userId: payment.userId,
      action: 'SETTLE_GATEWAY_PAYMENT_FAILED',
      resourceType: 'payment',
      resourceId: payment._id,
      newValue: {
        referenceId: payment.referenceId,
        gatewayOrderId: payment.gateway?.orderId,
        gatewayPaymentId: payment.gateway?.paymentId,
        reason: payment.failure?.reason,
      },
      status: 'success',
    });

    return this.emitPaymentUpdate(payment._id);
  }

  async keepPaymentPending(paymentDoc, gatewayDetails = {}, context = {}) {
    const payment = await Payment.findById(paymentDoc._id).populate('transactionId');
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'success') {
      return this.formatPaymentResponse(payment);
    }

    payment.status = 'pending';
    payment.gateway = {
      ...this.toPlainObject(payment.gateway),
      orderId: payment.gateway?.orderId || gatewayDetails.order_id || '',
      orderStatus: gatewayDetails.order_status || payment.gateway?.orderStatus || gatewayDetails.status || 'created',
      paymentId: gatewayDetails.id || payment.gateway?.paymentId || '',
      paymentStatus: gatewayDetails.status || payment.gateway?.paymentStatus || payment.gateway?.orderStatus || 'created',
      signature: context.signature || payment.gateway?.signature || '',
      checkoutVerifiedAt: context.source === 'checkout' ? new Date() : payment.gateway?.checkoutVerifiedAt,
      webhookReceivedAt: context.source === 'webhook' ? new Date() : payment.gateway?.webhookReceivedAt,
      webhookEventIds: this.appendUnique(payment.gateway?.webhookEventIds, context.eventId),
      lastPayload: gatewayDetails || payment.gateway?.lastPayload || null,
    };
    payment.reconciliation = {
      ...this.toPlainObject(payment.reconciliation),
      lastCheckedAt: new Date(),
      attempts: payment.reconciliation?.attempts || 0,
      lastStatus: 'pending',
    };
    await payment.save();

    return this.emitPaymentUpdate(payment._id);
  }

  async verifyPayment(userId, referenceId, payload = {}) {
    const payment = await this.getPaymentDocument(userId, referenceId);

    if (payment.status === 'success') {
      return this.formatPaymentResponse(payment);
    }

    const orderId = payload.razorpay_order_id || payload.orderId;
    const paymentId = payload.razorpay_payment_id || payload.paymentId;
    const signature = payload.razorpay_signature || payload.signature;

    validateRequiredField(orderId, 'orderId');
    validateRequiredField(paymentId, 'paymentId');
    validateRequiredField(signature, 'signature');

    if (orderId !== payment.gateway?.orderId) {
      throw new ValidationError('Gateway order does not match this payment', 'orderId');
    }

    this.verifyCheckoutSignature(orderId, paymentId, signature);

    const gatewayPayment = await this.requestRazorpay(`/v1/payments/${paymentId}`);

    if (gatewayPayment.order_id !== orderId) {
      throw new ValidationError('Gateway payment is linked to a different order', 'paymentId');
    }

    this.assertAmountMatches(payment, gatewayPayment.amount);
    const mappedStatus = this.mapGatewayStatus(gatewayPayment.status);

    if (mappedStatus === 'success') {
      return this.finalizeSuccessfulPayment(payment, gatewayPayment, {
        source: 'checkout',
        signature,
      });
    }

    if (mappedStatus === 'failed') {
      return this.markPaymentFailed(payment, gatewayPayment, {
        source: 'checkout',
        reason: gatewayPayment.error_description || 'Gateway reported payment failure',
      });
    }

    return this.keepPaymentPending(payment, gatewayPayment, {
      source: 'checkout',
      signature,
    });
  }

  chooseBestGatewayPayment(payments = []) {
    const ranked = [...payments].sort((left, right) => {
      const order = { captured: 3, authorized: 2, created: 1, failed: 0 };
      const leftScore = order[left?.status] ?? 0;
      const rightScore = order[right?.status] ?? 0;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return (right?.created_at || 0) - (left?.created_at || 0);
    });

    return ranked[0] || null;
  }

  async reconcilePayment(userId, referenceId) {
    const payment = await this.getPaymentDocument(userId, referenceId);

    if (payment.status === 'success') {
      return this.formatPaymentResponse(payment);
    }

    if (!payment.gateway?.orderId) {
      throw new ValidationError('This payment has no gateway order to reconcile', 'orderId');
    }

    const response = await this.requestRazorpay(`/v1/orders/${payment.gateway.orderId}/payments`);
    const gatewayPayment = this.chooseBestGatewayPayment(response.items || []);

    payment.reconciliation = {
      ...this.toPlainObject(payment.reconciliation),
      lastCheckedAt: new Date(),
      attempts: (payment.reconciliation?.attempts || 0) + 1,
    };
    await payment.save();

    if (!gatewayPayment) {
      return this.keepPaymentPending(payment, {
        order_id: payment.gateway.orderId,
        order_status: payment.gateway.orderStatus || 'created',
        status: payment.gateway.paymentStatus || 'created',
      }, {
        source: 'reconciliation',
      });
    }

    this.assertAmountMatches(payment, gatewayPayment.amount);
    const mappedStatus = this.mapGatewayStatus(gatewayPayment.status);

    if (mappedStatus === 'success') {
      return this.finalizeSuccessfulPayment(payment, gatewayPayment, {
        source: 'reconciliation',
      });
    }

    if (mappedStatus === 'failed') {
      return this.markPaymentFailed(payment, gatewayPayment, {
        source: 'reconciliation',
        reason: gatewayPayment.error_description || 'Gateway reconciliation reported failure',
      });
    }

    return this.keepPaymentPending(payment, gatewayPayment, {
      source: 'reconciliation',
    });
  }

  async processRazorpayWebhook({ rawBody, signature, eventId, payload }) {
    if (!rawBody) {
      throw new ValidationError('Missing webhook payload body for signature verification', 'rawBody');
    }

    validateRequiredField(signature, 'signature');
    this.verifyWebhookSignature(rawBody, signature);

    const event = payload?.event || '';
    const paymentEntity = payload?.payload?.payment?.entity || null;
    const orderEntity = payload?.payload?.order?.entity || null;
    const orderId = paymentEntity?.order_id || orderEntity?.id;

    if (!orderId) {
      return { ignored: true };
    }

    const payment = await Payment.findOne({ 'gateway.orderId': orderId }).populate('transactionId');
    if (!payment) {
      return { ignored: true };
    }

    if (eventId && payment.gateway?.webhookEventIds?.includes(eventId)) {
      return { duplicate: true };
    }

    if (paymentEntity?.amount !== undefined) {
      this.assertAmountMatches(payment, paymentEntity.amount);
    }

    const gatewayDetails = paymentEntity || orderEntity || {};
    const mappedStatus = this.mapGatewayStatus(gatewayDetails.status || orderEntity?.status || '');

    if (event === 'payment.captured' || event === 'order.paid' || mappedStatus === 'success') {
      return {
        payment: await this.finalizeSuccessfulPayment(payment, gatewayDetails, {
          source: 'webhook',
          eventId,
        }),
      };
    }

    if (event === 'payment.failed' || mappedStatus === 'failed') {
      return {
        payment: await this.markPaymentFailed(payment, gatewayDetails, {
          source: 'webhook',
          eventId,
          reason: gatewayDetails.error_description || `Gateway webhook reported ${event || 'failure'}`,
        }),
      };
    }

    return {
      payment: await this.keepPaymentPending(payment, gatewayDetails, {
        source: 'webhook',
        eventId,
      }),
    };
  }
}

module.exports = new PaymentService();
