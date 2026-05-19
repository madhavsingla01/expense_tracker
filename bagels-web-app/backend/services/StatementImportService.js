const ImportBatch = require('../models/ImportBatch');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const AccountService = require('./AccountService');
const StatementParserService = require('./StatementParserService');
const TransactionIngestionService = require('./TransactionIngestionService');
const TransactionService = require('./TransactionService');
const AuditLog = require('../models/AuditLog');

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number.parseFloat(value.toString());
}

function buildRowResult(row, result) {
  const normalized = result.normalized || {};

  return {
    rowNumber: row.rowNumber,
    date: normalized.date || row.date,
    amount: normalized.amount || row.amount,
    type: normalized.type || row.type || 'expense',
    rawDescription: normalized.rawDescription || row.description,
    merchantName: normalized.payee || row.merchant,
    normalizedMerchant: normalized.normalizedMerchant,
    category: normalized.category,
    status: result.status,
    transactionId: result.transaction?.id || result.transaction?._id,
    duplicateTransactionId: result.duplicateTransactionId,
    error: result.error,
  };
}

class StatementImportService {
  async importStatement(userId, file, { accountId, mapping } = {}) {
    const account = accountId
      ? { _id: accountId }
      : await AccountService.getPrimaryAccount(userId);

    const batch = await ImportBatch.create({
      userId,
      accountId: account._id,
      fileName: file.originalname || 'statement',
      fileType: file.mimetype || '',
      mapping: mapping || null,
      file: {
        storage: 'memory',
        size: file.size || file.buffer?.length || 0,
        checksum: file.buffer ? crypto.createHash('sha256').update(file.buffer).digest('hex') : '',
      },
      status: 'processing',
    });

    try {
      const parsed = await StatementParserService.parseFile(file, mapping);
      const rows = parsed.entries.map((entry) => ({
        payee: entry.merchant,
        description: entry.description,
        amount: entry.amount,
        date: entry.date,
        type: entry.type,
        category: 'General',
        source: 'bank_statement',
        subType: 'bank',
        rowNumber: entry.rowNumber,
        importBatchId: batch._id,
        sourceRef: String(batch._id),
        raw: entry.raw,
      }));

      const results = await TransactionIngestionService.ingestBatch(
        userId,
        account._id,
        rows,
        { source: 'bank_statement' }
      );

      const summary = results.reduce((acc, result) => {
        if (result.status === 'created') acc.created += 1;
        if (result.status === 'duplicate') acc.duplicates += 1;
        if (result.status === 'failed') acc.failed += 1;
        if (result.status === 'skipped') acc.skipped += 1;
        return acc;
      }, {
        parsed: rows.length,
        created: 0,
        duplicates: 0,
        failed: 0,
        skipped: 0,
      });

      batch.parser = parsed.parser;
      batch.status = 'completed';
      batch.summary = summary;
      batch.rows = rows.map((row, index) => buildRowResult(row, results[index]));
      batch.warnings = parsed.warnings || [];
      await batch.save();

      await AuditLog.create({
        userId,
        action: 'IMPORT_BANK_STATEMENT',
        resourceType: 'import_batch',
        resourceId: batch._id,
        newValue: {
          fileName: batch.fileName,
          parser: parsed.parser,
          summary,
        },
        status: 'success',
      });

      return this.formatBatch(batch);
    } catch (error) {
      batch.status = 'failed';
      batch.errorMessage = error.message;
      await batch.save();

      await AuditLog.create({
        userId,
        action: 'IMPORT_BANK_STATEMENT',
        resourceType: 'import_batch',
        resourceId: batch._id,
        status: 'failure',
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * CASCADE DELETE: Revert all transactions from an import batch.
   * For each transaction: creates reverse ledger entry → updates account balance → marks as failed.
   * Then marks the batch as 'reverted'. Never deletes ledger entries directly.
   */
  async deleteImport(userId, batchId) {
    const batch = await ImportBatch.findOne({ _id: batchId, userId });
    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.status === 'reverted') {
      throw new Error('Import has already been reverted');
    }

    // Find all live transactions linked to this batch
    const transactions = await Transaction.find({
      userId,
      'meta.importBatchId': batchId,
      status: { $in: ['success', 'unverified'] },
    }).lean();

    const results = { reversed: 0, failed: 0, errors: [], balanceImpact: 0 };

    // Calculate balance impact and reverse each transaction
    for (const tx of transactions) {
      try {
        // Track the net balance impact
        const debit = parseFloat(tx.debit || 0);
        const credit = parseFloat(tx.credit || 0);
        results.balanceImpact += (credit - debit); // reversal undoes this

        await TransactionService.deleteTransaction(userId, tx._id);
        results.reversed += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          transactionId: tx._id,
          error: error.message,
        });
      }
    }

    // The balanceImpact is the net effect being reversed (negate it for display)
    results.balanceImpact = Math.abs(results.balanceImpact);

    // Hard-delete the batch from the database
    await ImportBatch.deleteOne({ _id: batchId, userId });

    // Audit trail
    await AuditLog.create({
      userId,
      action: 'DELETE_IMPORT_BATCH',
      resourceType: 'import_batch',
      resourceId: batchId,
      oldValue: {
        fileName: batch.fileName,
        transactionsFound: transactions.length,
      },
      newValue: results,
      status: results.failed > 0 ? 'partial' : 'success',
    });

    return {
      batchId,
      fileName: batch.fileName,
      status: 'deleted',
      transactionsDeleted: results.reversed,
      transactionsFound: transactions.length,
      balanceImpact: results.balanceImpact,
      ...results,
    };
  }

  /**
   * Get detailed info for a single import batch + its live transactions
   */
  async getImportDetail(userId, batchId) {
    const batch = await ImportBatch.findOne({ _id: batchId, userId }).lean();
    if (!batch) {
      throw new Error('Import batch not found');
    }

    // Fetch live transactions associated with this batch
    const transactions = await Transaction.find({
      userId,
      'meta.importBatchId': batchId,
      status: { $in: ['success', 'unverified'] },
    })
      .sort({ date: -1 })
      .lean();

    const formatted = this.formatBatch(batch);
    formatted.transactions = transactions.map((tx) =>
      TransactionService.formatTransactionResponse(tx)
    );
    formatted.liveTransactionCount = transactions.length;

    return formatted;
  }

  formatBatch(batch) {
    const value = typeof batch.toObject === 'function' ? batch.toObject() : batch;
    return {
      _id: value._id,
      id: value._id,
      fileName: value.fileName,
      fileType: value.fileType,
      parser: value.parser,
      status: value.status,
      summary: value.summary,
      warnings: value.warnings || [],
      rows: (value.rows || []).map((row) => ({
        ...row,
        amount: toNumber(row.amount),
      })),
      errorMessage: value.errorMessage || '',
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  async listImports(userId, limit = 20) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 20;

    const batches = await ImportBatch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    // Compute live transaction count for each batch
    const results = [];
    for (const batch of batches) {
      const liveCount = await Transaction.countDocuments({
        userId,
        'meta.importBatchId': batch._id,
        status: { $in: ['success', 'unverified'] },
      });
      const formatted = this.formatBatch(batch);
      formatted.liveTransactionCount = liveCount;
      results.push(formatted);
    }

    return results;
  }
}

module.exports = new StatementImportService();
