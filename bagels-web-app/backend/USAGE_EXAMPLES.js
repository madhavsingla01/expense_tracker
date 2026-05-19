// Usage Examples - Database Models
// Copy and adapt these patterns in your controllers

const {
  User,
  Account,
  Transaction,
  Merchant,
  Ledger,
  AuditLog,
  Budget,
  AILearning,
} = require('./models');

// ============================================
// 1. CREATE TRANSACTION + LEDGER ENTRY
// ============================================

async function createExpenseTransaction(userId, accountId, data) {
  try {
    // Step 1: Create or find merchant
    let merchant = await Merchant.findOne({
      normalizedName: data.merchantName.toLowerCase().trim(),
    });

    if (!merchant) {
      merchant = await Merchant.create({
        name: data.merchantName,
        normalizedName: data.merchantName.toLowerCase().trim(),
        category: data.category,
        confidenceScore: 0.8, // AI confidence
      });
    }

    // Step 2: Create transaction
    const transaction = await Transaction.create({
      userId,
      accountId,
      type: 'expense',
      subType: data.subType, // 'upi', 'card', 'cash'
      amount: data.amount,
      currency: 'INR',
      merchantId: merchant._id,
      category: data.category,
      status: 'success',
      meta: {
        note: data.note,
        location: data.location,
      },
    });

    // Step 3: Update account balance (CRITICAL)
    const account = await Account.findById(accountId);
    const newBalance = Number(account.balance) - Number(data.amount);

    // Step 4: Create ledger entry (MUST DO)
    await Ledger.create({
      userId,
      accountId,
      transactionId: transaction._id,
      type: 'debit',
      amount: data.amount,
      balanceAfter: newBalance,
      description: `Expense at ${data.merchantName}`,
      reference: transaction._id.toString(),
    });

    // Step 5: Update account balance
    await Account.findByIdAndUpdate(accountId, { balance: newBalance });

    // Step 6: Log action for audit
    await AuditLog.create({
      userId,
      action: 'CREATE_TRANSACTION',
      resourceType: 'transaction',
      resourceId: transaction._id,
      newValue: transaction,
      status: 'success',
    });

    // Step 7: Store AI learning (optional)
    await AILearning.findOneAndUpdate(
      { userId, input: data.merchantName.toLowerCase() },
      {
        $set: {
          predictedCategory: data.category,
          confidence: 0.9,
          lastUsedAt: new Date(),
        },
        $inc: { timesUsed: 1 },
      },
      { upsert: true }
    );

    return transaction;
  } catch (error) {
    // Log failure
    await AuditLog.create({
      userId,
      action: 'CREATE_TRANSACTION',
      status: 'failure',
      errorMessage: error.message,
    });
    throw error;
  }
}

// ============================================
// 2. DELETE TRANSACTION (WITH LEDGER REVERSAL)
// ============================================

async function deleteTransaction(userId, transactionId) {
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new Error('Transaction not found');

    // Store for audit
    const oldValue = transaction.toObject();

    // Remove transaction
    await Transaction.findByIdAndDelete(transactionId);

    // Remove ledger entry
    await Ledger.findOneAndDelete({ transactionId });

    // Restore account balance
    const lastLedger = await Ledger.findOne({
      accountId: transaction.accountId,
      transactionId: { $ne: transactionId },
    }).sort({ createdAt: -1 });

    const restoredBalance = lastLedger?.balanceAfter || 0;
    await Account.findByIdAndUpdate(transaction.accountId, {
      balance: restoredBalance,
    });

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

// ============================================
// 3. GET ACCOUNT BALANCE (FROM LEDGER)
// ============================================

async function getAccountBalance(accountId) {
  // Get latest ledger entry for this account
  const latestEntry = await Ledger.findOne({ accountId })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestEntry) {
    // No transactions yet
    const account = await Account.findById(accountId);
    return account.balance;
  }

  return latestEntry.balanceAfter;
}

// ============================================
// 4. CHECK BUDGET STATUS
// ============================================

async function getBudgetStatus(userId, category, date = new Date()) {
  const budget = await Budget.findOne({
    userId,
    category,
    startDate: { $lte: date },
    endDate: { $gte: date },
  });

  if (!budget) return null;

  const spentAmount = budget.spent;
  const remaining = Number(budget.budgetAmount) - Number(spentAmount);

  // Calculate alerts
  const alerts = [50, 75, 90, 100].map((percent) => {
    const threshold = (Number(budget.budgetAmount) * percent) / 100;
    const triggered = Number(spentAmount) >= threshold;

    return { percent, triggered };
  });

  return {
    category,
    budgetAmount: budget.budgetAmount,
    spent: spentAmount,
    remaining: Math.max(0, remaining),
    percentUsed: (Number(spentAmount) / Number(budget.budgetAmount)) * 100,
    alerts,
  };
}

// ============================================
// 5. LINK NEW PAYMENT ACCOUNT
// ============================================

async function linkPaymentAccount(userId, data) {
  try {
    // Check if account already exists
    const existing = await Account.findOne({
      userId,
      provider: data.provider,
      type: data.type,
    });

    if (existing) {
      throw new Error(`${data.provider} ${data.type} already linked`);
    }

    // Create account
    const account = await Account.create({
      userId,
      type: data.type, // 'bank', 'wallet', 'upi'
      provider: data.provider,
      balance: data.initialBalance || 0,
      currency: 'INR',
      status: 'active',
      accountNumber: data.accountNumber,
      upiId: data.upiId,
    });

    // Audit
    await AuditLog.create({
      userId,
      action: 'LINK_ACCOUNT',
      resourceType: 'account',
      resourceId: account._id,
      newValue: account,
      status: 'success',
    });

    return account;
  } catch (error) {
    await AuditLog.create({
      userId,
      action: 'LINK_ACCOUNT',
      status: 'failure',
      errorMessage: error.message,
    });
    throw error;
  }
}

// ============================================
// 6. GET AUDIT TRAIL
// ============================================

async function getAuditTrail(userId, filters = {}) {
  const query = { userId };

  if (filters.action) query.action = filters.action;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  return await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100)
    .lean();
}

// ============================================
// 7. GET AI CATEGORIZATION SUGGESTIONS
// ============================================

async function getAICategorySuggestions(userId, merchantName) {
  const input = merchantName.toLowerCase().trim();

  // Check if we've seen this before
  const learned = await AILearning.findOne({ userId, input }).lean();

  if (learned && learned.confidence > 0.8) {
    return {
      category: learned.predictedCategory,
      confidence: learned.confidence,
      source: 'learned',
    };
  }

  // TODO: Call external AI/ML API for prediction
  // This is a placeholder
  return {
    category: 'General',
    confidence: 0.5,
    source: 'default',
  };
}

// ============================================
// 8. RECONCILE ACCOUNT (VERIFY BALANCE)
// ============================================

async function reconcileAccount(accountId) {
  // Get all ledger entries
  const entries = await Ledger.find({ accountId })
    .sort({ createdAt: 1 })
    .lean();

  if (entries.length === 0) return { status: 'ok', message: 'No transactions' };

  // Calculate running balance
  let calculatedBalance = 0;
  const mismatches = [];

  for (const entry of entries) {
    const expectedBalance = Number(entry.balanceAfter);
    if (Math.abs(calculatedBalance - expectedBalance) > 0.01) {
      // Allow for rounding
      mismatches.push({
        entryId: entry._id,
        calculatedBalance,
        recordedBalance: expectedBalance,
      });
    }
    calculatedBalance = expectedBalance;
  }

  const account = await Account.findById(accountId);
  const finalBalance = entries[entries.length - 1]?.balanceAfter || 0;

  return {
    status: mismatches.length === 0 ? 'ok' : 'mismatch',
    finalBalance,
    accountBalance: account.balance,
    mismatches,
  };
}

// ============================================
// EXPORT
// ============================================

module.exports = {
  createExpenseTransaction,
  deleteTransaction,
  getAccountBalance,
  getBudgetStatus,
  linkPaymentAccount,
  getAuditTrail,
  getAICategorySuggestions,
  reconcileAccount,
};
