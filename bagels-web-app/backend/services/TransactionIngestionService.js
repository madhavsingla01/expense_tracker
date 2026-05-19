const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const AccountService = require('./AccountService');
const TransactionService = require('./TransactionService');
const IntelligenceService = require('./IntelligenceService');
const { ValidationError, validateAmount, validateDate } = require('./ValidationService');

const DEDUPE_SOURCES = new Set(['ocr', 'scan', 'bank_statement', 'statement', 'upi_intent']);

function dateOnly(value) {
  const date = value instanceof Date ? value : validateDate(value || new Date());
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDay(value) {
  return dateOnly(value).toISOString().split('T')[0];
}

function stableHash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function cleanPayee(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

class TransactionIngestionService {
  shouldDedupe(source, mode) {
    if (mode === 'allow') return false;
    if (mode === 'force') return true;
    return DEDUPE_SOURCES.has(source);
  }

  buildDedupeKey({ userId, date, amount, normalizedMerchant }) {
    const base = [
      String(userId),
      toIsoDay(date),
      Number(amount).toFixed(2),
      normalizedMerchant || 'unknown',
    ].join('|');

    return stableHash(base);
  }

  async normalizeInput(userId, input, source = 'manual') {
    const amount = validateAmount(input.amount);
    const date = dateOnly(input.date || new Date());
    const type = input.type === 'income' ? 'income' : 'expense';
    const payee = cleanPayee(input.payee || input.merchant || input.vendorName || input.description);

    if (!payee) {
      throw new ValidationError('Merchant/payee could not be detected', 'payee');
    }

    const normalizedMerchant = IntelligenceService.normalizeName(payee);
    const prediction = await IntelligenceService.predictCategory(userId, payee);
    const category = cleanPayee(input.category && input.category !== 'General'
      ? input.category
      : prediction.category || 'General');

    return {
      type,
      subType: input.subType || (source === 'upi_intent' ? 'upi' : 'bank'),
      amount,
      date,
      payee,
      category,
      notes: input.notes || input.note || '',
      source,
      status: input.status,
      receiptImage: input.receiptImage,
      normalizedMerchant,
      confidence: prediction.confidence,
      predictionSource: prediction.source,
      rawDescription: input.description || input.rawDescription || payee,
      rowNumber: input.rowNumber,
      importBatchId: input.importBatchId,
      sourceRef: input.sourceRef,
      raw: input.raw,
      meta: input.meta || {},
    };
  }

  async findDuplicate(userId, normalized) {
    const start = dateOnly(normalized.date);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const dedupeKey = this.buildDedupeKey({
      userId,
      date: normalized.date,
      amount: normalized.amount,
      normalizedMerchant: normalized.normalizedMerchant,
    });

    const duplicate = await Transaction.findOne({
      userId,
      status: { $in: ['success', 'unverified'] },
      date: { $gte: start, $lte: end },
      $or: [
        { 'meta.dedupeKey': dedupeKey },
        {
          'meta.normalizedMerchant': normalized.normalizedMerchant,
          $or: [
            { debit: normalized.type === 'expense' ? Number(normalized.amount) : 0 },
            { credit: normalized.type === 'income' ? Number(normalized.amount) : 0 },
          ],
        },
      ],
    }).lean();

    return { duplicate, dedupeKey };
  }

  async ingestOne(userId, accountId, input, options = {}) {
    const source = options.source || input.source || 'manual';
    const normalized = await this.normalizeInput(userId, input, source);
    const { duplicate, dedupeKey } = await this.findDuplicate(userId, normalized);

    if (duplicate && this.shouldDedupe(source, options.dedupeMode)) {
      return {
        status: 'duplicate',
        duplicateTransactionId: duplicate._id,
        dedupeKey,
        normalized,
      };
    }

    const transaction = await TransactionService.createTransaction(userId, accountId, {
      type: normalized.type,
      subType: normalized.subType,
      amount: normalized.amount,
      date: normalized.date,
      payee: normalized.payee,
      category: normalized.category,
      notes: normalized.notes,
      source,
      status: normalized.status,
      receiptImage: normalized.receiptImage,
      meta: {
        ...normalized.meta,
        confidence: normalized.confidence,
        predictionSource: normalized.predictionSource,
        sourceRef: normalized.sourceRef,
        rawDescription: normalized.rawDescription,
        normalizedMerchant: normalized.normalizedMerchant,
        dedupeKey,
        importBatchId: normalized.importBatchId,
        statementRow: normalized.rowNumber,
        rawResponse: normalized.raw,
      },
    });

    return {
      status: 'created',
      transaction,
      dedupeKey,
      normalized,
    };
  }

  async ingestBatch(userId, accountId, rows, options = {}) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const results = [];

    for (const row of safeRows) {
      try {
        const result = await this.ingestOne(userId, accountId, row, options);
        results.push(result);
      } catch (error) {
        results.push({
          status: 'failed',
          error: error.message,
          row,
        });
      }
    }

    return results;
  }

  async ingestWithPrimaryAccount(userId, input, options = {}) {
    const account = options.accountId
      ? { _id: options.accountId }
      : await AccountService.getPrimaryAccount(userId);

    return this.ingestOne(userId, account._id, input, options);
  }
}

module.exports = new TransactionIngestionService();
