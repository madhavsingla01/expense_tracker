/**
 * Transaction Service
 * Handles transaction creation, deletion, validation
 * Core business logic for expense/income tracking
 */

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Ledger = require('../models/Ledger');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const IntelligenceService = require('./IntelligenceService');
const BudgetService = require('./BudgetService');
const {
  ValidationError,
  validateAmount,
  validateRequiredField,
  validateEnum,
  validateDate,
} = require('./ValidationService');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class TransactionService {
  toNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return Number.parseFloat(value.toString());
  }

  isTransactionUnsupported(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('transaction numbers are only allowed') ||
      message.includes('replica set member or mongos') ||
      message.includes('transactions are not supported')
    );
  }

  async runFinancialWrite(operation) {
    const session = await mongoose.startSession();

    try {
      let result;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (!this.isTransactionUnsupported(error)) {
        throw error;
      }

      // Local standalone MongoDB cannot run multi-document transactions.
      // Production deployments should run on a replica set/Atlas so this path is never used.
      return operation(null);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create transaction (wrapper) - delegates to income/expense creation
   */
  async createTransaction(userId, accountId, transactionData) {
    const type = (transactionData && transactionData.type) || 'expense';
    if (type === 'income') {
      return await this.createIncomeTransaction(userId, accountId, transactionData);
    }
    return await this.createExpenseTransaction(userId, accountId, transactionData);
  }

  /**
   * Format transaction for response
   */
  formatTransactionResponse(transaction) {
    const toNum = (dec) => (dec ? parseFloat(dec.toString()) : 0);
    const debit = toNum(transaction.debit);
    const credit = toNum(transaction.credit);
    const amount = debit > 0 ? debit : credit;
    const source = transaction.source === 'ocr'
      ? 'scan'
      : transaction.source === 'bank_statement'
        ? 'statement'
        : transaction.source === 'upi_intent'
          ? 'upi_intent'
          : transaction.subType === 'upi'
            ? 'payment'
            : 'manual';

    return {
      _id: transaction._id,
      id: transaction._id,
      date: transaction.date ? transaction.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      payee: transaction.vendorName || 'General',
      category: transaction.category,
      amount,
      debit,
      credit,
      balanceAfter: toNum(transaction.balanceAfter),
      type: transaction.type,
      subType: transaction.subType,
      currency: transaction.currency || 'INR',
      tags: transaction.tags || [],
      status: transaction.status || 'success',
      source,
      notes: transaction.meta?.note || '',
      referenceId: transaction.meta?.referenceId || null,
      txnId: transaction.meta?.txnId || null,
      receiptUrl: transaction.receiptUrl ? `/uploads/receipts/${transaction.receiptUrl}` : null,
      confidence: transaction.meta?.confidence || null,
      predictionSource: transaction.meta?.predictionSource || null,
      normalizedMerchant: transaction.meta?.normalizedMerchant || null,
      duplicateKey: transaction.meta?.dedupeKey || null,
      duplicateOf: transaction.meta?.duplicateOf || null,
      importBatchId: transaction.meta?.importBatchId || null,
      splitGroupId: transaction.splitGroupId || null,
      parentTransactionId: transaction.parentTransactionId || null,
      linkedTransactionIds: transaction.linkedTransactionIds || [],
      recurring: transaction.recurring || null,
      accountName: transaction.accountId?.name || 'Main Account',
    };
  }

  async resolveCurrency(userId, requestedCurrency) {
    if (requestedCurrency) return String(requestedCurrency).toUpperCase();
    const user = await User.findById(userId).select('profile.currency').lean();
    return user?.profile?.currency || 'INR';
  }

  /**
   * Map frontend source values to model-valid source enum
   * Frontend sends: 'manual', 'scan', 'payment', 'statement', 'upi_intent'
   */
  mapSource(source) {
    const sourceMap = {
      'manual': 'manual',
      'scan': 'ocr',
      'ocr': 'ocr',
      'payment': 'manual',
      'statement': 'bank_statement',
      'bank_statement': 'bank_statement',
      'bank_sync': 'bank_sync',
      'upi_intent': 'upi_intent',
    };
    return sourceMap[source] || 'manual';
  }

  /**
   * Validate transaction input
   */
  validateTransactionInput(data) {
    const { amount, category, type, payee } = data;

    validateRequiredField(category, 'Category');
    validateRequiredField(type, 'Transaction type');
    validateEnum(type, ['expense', 'income'], 'Type');

    if (type === 'expense') {
      const subType = data.subType || 'cash';
      validateEnum(subType, ['upi', 'card', 'cash', 'bank', 'wallet'], 'SubType');
    }

    validateAmount(amount);

    if (type === 'expense') {
      validateRequiredField(payee, 'Vendor/Payee name');
    }
  }

  /**
   * Process and save receipt image
   */
  saveReceiptImage(receiptImage) {
    if (!receiptImage) return '';

    try {
      const matches = receiptImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new ValidationError('Invalid receipt image format', 'receiptImage');
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const ext = matches[1].split('/')[1] || 'jpeg';
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(__dirname, '..', 'uploads', 'receipts', filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filepath, buffer);
      return filename;
    } catch (error) {
      throw new ValidationError('Failed to save receipt image: ' + error.message, 'receiptImage');
    }
  }

  /**
   * Create expense transaction (with ledger entry)
   */
  async createExpenseTransaction(userId, accountId, transactionData) {
    // Validate input
    this.validateTransactionInput({ ...transactionData, type: 'expense', subType: transactionData.subType || 'cash' });

    const {
      payee,
      category,
      amount,
      subType,
      source,
      date,
      notes,
      receiptImage,
      meta,
      tags,
      splitGroupId,
      parentTransactionId,
      linkedTransactionIds,
      recurring,
    } = transactionData;

    const numAmount = validateAmount(amount);
    const transactionDate = date ? validateDate(date) : new Date();
    const currency = await this.resolveCurrency(userId, transactionData.currency);

    // Process receipt if provided
    const receiptFilename = receiptImage ? this.saveReceiptImage(receiptImage) : '';

    // Map frontend source to model-valid source
    const modelSource = this.mapSource(source);

    // ── INTELLIGENCE PIPELINE ──
    // Run full pipeline: normalize → detect merchant → predict → learn
    const intelligence = await IntelligenceService.processTransaction(userId, payee, category);
    const finalCategory = intelligence.prediction.category;
    const merchant = intelligence.merchant;
    
    const transaction = await this.runFinancialWrite(async (session) => {
      // Calculate ledger balances first to get balanceAfter
      const { newBalance } = await this.createLedgerEntry(userId, accountId, null, 'expense', numAmount, {
        session,
        description: `Expense: ${payee}`,
        dryRun: true,
      });

      const [created] = await Transaction.create([{
        userId,
        accountId,
        type: 'expense',
        subType: subType || 'cash',
        debit: numAmount,
        credit: 0,
        balanceAfter: newBalance,
        currency,
        vendorName: payee,
        merchantId: merchant._id,
        category: finalCategory,
        tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        splitGroupId: splitGroupId || '',
        parentTransactionId: parentTransactionId || null,
        linkedTransactionIds: Array.isArray(linkedTransactionIds) ? linkedTransactionIds : [],
        recurring: recurring || undefined,
        date: transactionDate,
        status: transactionData.status || 'success',
        source: modelSource,
        receiptUrl: receiptFilename,
        meta: {
          ...(meta || {}),
          note: notes,
          confidence: intelligence.prediction.confidence,
          predictionSource: intelligence.prediction.source,
        },
      }], session ? { session } : {});

      // Commit ledger entry with actual transaction ID
      await this.createLedgerEntry(userId, accountId, created._id, 'expense', numAmount, {
        session,
        description: `Expense: ${payee}`,
        currency,
        source: modelSource,
      });

      return created;
    });

    // Update budget spent for category (best-effort)
    try {
      await BudgetService.updateBudgetSpent(userId, finalCategory, numAmount);
    } catch (err) {
      console.error('Budget update failed:', err.message);
    }

    // Log to audit trail
    await AuditLog.create({
      userId,
      action: 'CREATE_EXPENSE',
      resourceType: 'transaction',
      resourceId: transaction._id,
      newValue: transaction,
      status: 'success',
    });

    // ── LEARN from this transaction ──
    await IntelligenceService.learn(userId, payee, finalCategory, modelSource);

    return this.formatTransactionResponse(transaction);
  }

  /**
   * Create income transaction
   */
  async createIncomeTransaction(userId, accountId, transactionData) {
    this.validateTransactionInput({ ...transactionData, type: 'income' });

    const {
      payee,
      category,
      amount,
      source,
      date,
      notes,
      meta,
      tags,
      splitGroupId,
      parentTransactionId,
      linkedTransactionIds,
      recurring,
    } = transactionData;

    const numAmount = validateAmount(amount);
    const transactionDate = date ? validateDate(date) : new Date();
    const currency = await this.resolveCurrency(userId, transactionData.currency);

    const modelSource = this.mapSource(source);

    const transaction = await this.runFinancialWrite(async (session) => {
      const { newBalance } = await this.createLedgerEntry(userId, accountId, null, 'income', numAmount, {
        session,
        description: `Income: ${payee || 'Income Source'}`,
        dryRun: true,
      });

      const [created] = await Transaction.create([{
        userId,
        accountId,
        type: 'income',
        subType: source === 'payment' ? 'upi' : 'bank',
        debit: 0,
        credit: numAmount,
        balanceAfter: newBalance,
        currency,
        vendorName: payee || 'Income Source',
        category: category || 'Income',
        tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        splitGroupId: splitGroupId || '',
        parentTransactionId: parentTransactionId || null,
        linkedTransactionIds: Array.isArray(linkedTransactionIds) ? linkedTransactionIds : [],
        recurring: recurring || undefined,
        date: transactionDate,
        status: transactionData.status || 'success',
        source: modelSource,
        meta: {
          ...(meta || {}),
          note: notes,
        },
      }], session ? { session } : {});

      await this.createLedgerEntry(userId, accountId, created._id, 'income', numAmount, {
        session,
        description: `Income: ${payee || 'Income Source'}`,
        currency,
        source: modelSource,
      });

      return created;
    });

    await AuditLog.create({
      userId,
      action: 'CREATE_INCOME',
      resourceType: 'transaction',
      resourceId: transaction._id,
      newValue: transaction,
      status: 'success',
    });

    return this.formatTransactionResponse(transaction);
  }

  /**
   * Create ledger entry (CRITICAL - source of truth for balance)
   */
  async createLedgerEntry(userId, accountId, transactionId, type, amount, options = {}) {
    const {
      session,
      description,
      reference,
      entryType = 'normal',
      dryRun = false,
      source = 'transaction',
      currency = 'INR',
      meta = {},
    } = options;
    
    // Strict order: Get last ledger entry
    let lastEntryQuery = Ledger.findOne({ accountId }).sort({ createdAt: -1 }).lean();
    if (session) lastEntryQuery = lastEntryQuery.session(session);
    const lastEntry = await lastEntryQuery;

    const currentBalance = this.toNumber(lastEntry?.balanceAfter || 0);
    const numericAmount = this.toNumber(amount);
    
    const isCredit = type === 'income' || type === 'credit';
    const debitVal = isCredit ? 0 : numericAmount;
    const creditVal = isCredit ? numericAmount : 0;
    
    const newBalance = currentBalance + creditVal - debitVal;

    if (dryRun) return { newBalance };

    // Create append-only ledger entry
    await Ledger.create([{
      userId,
      accountId,
      transactionId,
      entryType,
      debit: debitVal,
      credit: creditVal,
      balanceAfter: newBalance,
      description,
      reference: reference || transactionId?.toString(),
      source,
      currency,
      meta,
    }], session ? { session } : {});

    // Update account balance
    await Account.findByIdAndUpdate(accountId, { balance: newBalance }, session ? { session } : {});
    
    return { newBalance };
  }

  /**
   * Delete transaction (with ledger reversal)
   */
  async deleteTransaction(userId, transactionId) {
    try {
      const transaction = await Transaction.findOne({ _id: transactionId, userId });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Store for audit before deletion
      const oldValue = transaction.toObject();

      await this.runFinancialWrite(async (session) => {
        const reversalType = transaction.type === 'income' ? 'expense' : 'income'; // reverse effect
        
        // 1. Create reversal ledger entry (audit trail)
        await this.createLedgerEntry(
          userId,
          transaction.accountId,
          transaction._id,
          reversalType,
          this.toNumber(transaction.amount),
          {
            session,
            entryType: 'reversal',
            reference: `REV-${transaction._id}`,
            description: `Reversal: ${transaction.vendorName || 'Deleted'}`,
          }
        );

        // 2. Hard-delete the transaction document from MongoDB
        if (session) {
          await Transaction.deleteOne({ _id: transaction._id }, { session });
        } else {
          await Transaction.deleteOne({ _id: transaction._id });
        }
      });

      // Clean up receipt file if it exists
      if (oldValue.receiptUrl) {
        try {
          const receiptPath = path.join(__dirname, '..', 'uploads', 'receipts', oldValue.receiptUrl);
          if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);
        } catch { /* best effort */ }
      }

      if (oldValue.type === 'expense') {
        await BudgetService.reverseBudgetAmount(userId, oldValue.category, this.toNumber(oldValue.amount));
      }

      // Audit log
      await AuditLog.create({
        userId,
        action: 'DELETE_TRANSACTION',
        resourceType: 'transaction',
        resourceId: transactionId,
        oldValue,
        status: 'success',
      });

      return { success: true };
    } catch (error) {
      await AuditLog.create({
        userId,
        action: 'DELETE_TRANSACTION',
        resourceId: transactionId,
        status: 'failure',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Get transactions (all types)
   */
  buildTransactionQuery(userId, filters = {}) {
    const query = {
      userId,
      status: { $in: ['success', 'unverified'] },
    };

    if (filters.type && ['expense', 'income', 'transfer'].includes(filters.type)) {
      query.type = filters.type;
    }
    if (filters.category) query.category = filters.category;
    if (filters.accountId) query.accountId = filters.accountId;
    if (filters.source) query.source = this.mapSource(filters.source);
    if (filters.tags) {
      const tags = String(filters.tags).split(',').map((tag) => tag.trim()).filter(Boolean);
      if (tags.length > 0) query.tags = { $all: tags };
    }
    if (filters.start || filters.end) {
      query.date = {};
      if (filters.start) query.date.$gte = validateDate(filters.start);
      if (filters.end) {
        const end = validateDate(filters.end);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    if (filters.minAmount || filters.maxAmount) {
      const amountConditions = {};
      if (filters.minAmount) amountConditions.$gte = Number(filters.minAmount);
      if (filters.maxAmount) amountConditions.$lte = Number(filters.maxAmount);
      query.$or = [
        { debit: amountConditions },
        { credit: amountConditions },
      ];
    }
    if (filters.search) {
      const regex = new RegExp(String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchOr = [
        { vendorName: regex },
        { category: regex },
        { tags: regex },
        { 'meta.note': regex },
        { 'meta.referenceId': regex },
        { 'meta.txnId': regex },
        { 'meta.rawDescription': regex },
      ];
      query.$and = [{ $or: searchOr }];
    }

    return query;
  }

  async getTransactions(userId, filters = {}) {
    const parsedLimit = Number.parseInt(filters.limit, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 500)
      : 500;

    const transactions = await Transaction
      .find(this.buildTransactionQuery(userId, filters))
      .populate('accountId', 'name')
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return transactions.map((t) => this.formatTransactionResponse(t));
  }

  /**
   * Update transaction (with feedback loop for category corrections)
   */
  async updateTransaction(userId, transactionId, updates) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const oldCategory = transaction.category;
    const oldValue = transaction.toObject();
    const oldAmount = this.toNumber(transaction.amount);
    const oldReceiptUrl = transaction.receiptUrl;
    const amountChanged = updates.amount !== undefined && this.toNumber(updates.amount) !== oldAmount;
    const categoryChanged = updates.category && updates.category !== oldCategory;

    await this.runFinancialWrite(async (session) => {
      // If amount/type changes, we must fully reverse and re-apply
      if (amountChanged) {
        // 1. Reversal
        const reversalType = transaction.type === 'income' ? 'expense' : 'income';
        await this.createLedgerEntry(userId, transaction.accountId, transaction._id, reversalType, this.toNumber(transaction.amount), {
          session, entryType: 'reversal', reference: `REV-${transaction._id}`, description: `Reversal for update: ${transaction.vendorName}`,
        });
        
        // 2. Apply new values
        const newAmount = this.toNumber(updates.amount);
        const newType = transaction.type;
        const { newBalance } = await this.createLedgerEntry(userId, transaction.accountId, transaction._id, newType, newAmount, {
          session, entryType: 'correction', reference: `COR-${transaction._id}`, description: `Correction: ${updates.payee || transaction.vendorName}`,
        });
        
        // Update Transaction
        transaction.debit = newType === 'expense' ? newAmount : 0;
        transaction.credit = newType === 'income' ? newAmount : 0;
        transaction.balanceAfter = newBalance;
      }

      // Apply other allowed updates
      if (updates.category) transaction.category = updates.category;
      if (updates.notes !== undefined) {
        transaction.meta = transaction.meta || {};
        transaction.meta.note = updates.notes;
      }
      if (updates.payee) transaction.vendorName = updates.payee;
      if (updates.date !== undefined) transaction.date = validateDate(updates.date);
      if (updates.tags !== undefined) {
        transaction.tags = Array.isArray(updates.tags)
          ? updates.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [];
      }
      if (updates.receiptImage) {
        transaction.receiptUrl = this.saveReceiptImage(updates.receiptImage);
      }

      await transaction.save(session ? { session } : {});
    });

    if (oldReceiptUrl && updates.receiptImage && oldReceiptUrl !== transaction.receiptUrl) {
      try {
        const receiptPath = path.join(__dirname, '..', 'uploads', 'receipts', oldReceiptUrl);
        if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);
      } catch { /* best effort */ }
    }

    if (transaction.type === 'expense' && (amountChanged || categoryChanged)) {
      await BudgetService.reverseBudgetAmount(userId, oldCategory, oldAmount);
      await BudgetService.updateBudgetSpent(userId, transaction.category, this.toNumber(transaction.amount));
    }

    // ── FEEDBACK LOOP ──
    // If category changed, feed correction into intelligence system
    if (updates.category && updates.category !== oldCategory) {
      await IntelligenceService.handleCorrection(
        userId,
        transaction.vendorName,
        oldCategory,
        updates.category
      );
    }

    // Audit
    await AuditLog.create({
      userId,
      action: 'UPDATE_TRANSACTION',
      resourceType: 'transaction',
      resourceId: transactionId,
      oldValue,
      newValue: transaction.toObject(),
      status: 'success',
    });

    return this.formatTransactionResponse(transaction);
  }

  async duplicateTransaction(userId, transactionId, overrides = {}) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId }).lean();
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const cloned = await this.createTransaction(
      userId,
      overrides.accountId || transaction.accountId,
      {
        type: transaction.type,
        subType: overrides.subType || transaction.subType,
        amount: overrides.amount || this.toNumber(transaction.debit || transaction.credit),
        date: overrides.date || new Date(),
        payee: overrides.payee || transaction.vendorName,
        category: overrides.category || transaction.category,
        notes: overrides.notes !== undefined ? overrides.notes : transaction.meta?.note,
        source: overrides.source || 'manual',
        tags: overrides.tags || transaction.tags || [],
        currency: overrides.currency || transaction.currency,
        meta: {
          ...(overrides.meta || {}),
          duplicateOf: transaction._id,
        },
      }
    );

    await AuditLog.create({
      userId,
      action: 'DUPLICATE_TRANSACTION',
      resourceType: 'transaction',
      resourceId: cloned.id || cloned._id,
      oldValue: { sourceTransactionId: transaction._id },
      newValue: cloned,
      status: 'success',
    });

    return cloned;
  }

  async splitTransaction(userId, transactionId, splits = []) {
    if (!Array.isArray(splits) || splits.length < 2) {
      throw new ValidationError('At least two split entries are required', 'splits');
    }

    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const originalAmount = this.toNumber(transaction.amount);
    const normalizedSplits = splits.map((split) => ({
      amount: validateAmount(split.amount),
      payee: split.payee || transaction.vendorName,
      category: split.category || transaction.category,
      notes: split.notes || transaction.meta?.note || '',
      tags: Array.isArray(split.tags) ? split.tags : transaction.tags || [],
    }));
    const splitTotal = normalizedSplits.reduce((sum, split) => sum + split.amount, 0);

    if (Math.abs(splitTotal - originalAmount) > 0.01) {
      throw new ValidationError('Split amounts must equal the original transaction amount', 'splits');
    }

    const splitGroupId = crypto.randomUUID();
    const originalSnapshot = transaction.toObject();

    await this.deleteTransaction(userId, transaction._id);

    const created = [];
    for (const split of normalizedSplits) {
      const child = await this.createTransaction(userId, originalSnapshot.accountId, {
        type: originalSnapshot.type,
        subType: originalSnapshot.subType,
        amount: split.amount,
        date: originalSnapshot.date,
        payee: split.payee,
        category: split.category,
        notes: split.notes,
        source: originalSnapshot.source,
        tags: split.tags,
        currency: originalSnapshot.currency,
        splitGroupId,
        parentTransactionId: originalSnapshot._id,
        meta: {
          splitGroupId,
          parentTransactionId: originalSnapshot._id,
          originalAmount,
        },
      });
      created.push(child);
    }

    await AuditLog.create({
      userId,
      action: 'SPLIT_TRANSACTION',
      resourceType: 'transaction',
      resourceId: originalSnapshot._id,
      oldValue: originalSnapshot,
      newValue: { splitGroupId, transactions: created },
      status: 'success',
    });

    return {
      splitGroupId,
      transactions: created,
    };
  }

  advanceRecurringDate(date, frequency) {
    const next = new Date(date);
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  async runDueRecurringTransactions(userId, until = new Date()) {
    const dueTemplates = await Transaction.find({
      userId,
      'recurring.enabled': true,
      'recurring.nextRunAt': { $lte: until },
      status: { $in: ['success', 'unverified'] },
    }).lean();
    const created = [];

    for (const template of dueTemplates) {
      const recurring = template.recurring || {};
      if (recurring.endAt && new Date(recurring.endAt) < new Date()) continue;

      const child = await this.createTransaction(userId, template.accountId, {
        type: template.type,
        subType: template.subType,
        amount: this.toNumber(template.debit || template.credit),
        date: recurring.nextRunAt || new Date(),
        payee: template.vendorName,
        category: template.category,
        notes: template.meta?.note || '',
        source: template.source,
        tags: template.tags || [],
        currency: template.currency,
        meta: {
          recurringTemplateId: recurring.templateId || template._id,
        },
      });
      created.push(child);

      const nextRunAt = this.advanceRecurringDate(recurring.nextRunAt || new Date(), recurring.frequency);
      await Transaction.updateOne(
        { _id: template._id, userId },
        { $set: { 'recurring.nextRunAt': nextRunAt } }
      );
    }

    return created;
  }

  /**
   * Get account balance from ledger
   */
  async getAccountBalance(accountId) {
    const latestEntry = await Ledger.findOne({ accountId })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestEntry) {
      const account = await Account.findById(accountId);
      return this.toNumber(account?.balance || 0);
    }

    return this.toNumber(latestEntry.balanceAfter);
  }
}

module.exports = new TransactionService();
