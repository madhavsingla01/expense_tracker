/**
 * Account Deletion Service
 * Handles complete, cascading deletion of all user data.
 * 
 * DELETION ORDER (dependencies first):
 * 1. Ledger entries (depends on transactions & accounts)
 * 2. Transactions (depends on accounts & merchants)
 * 3. Import batches (depends on transactions)
 * 4. Payment attempts (depends on payments)
 * 5. Payments (depends on user)
 * 6. Budgets
 * 7. AI Learning data
 * 8. Learning rules
 * 9. Merchants (user-scoped)
 * 10. Audit logs
 * 11. Accounts
 * 12. Bills / Goals / Analytics / Notifications
 * 13. Uploaded files (receipts)
 * 14. User document
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const AuditLog = require('../models/AuditLog');
const Budget = require('../models/Budget');
const AILearning = require('../models/AILearning');
const LearningRule = require('../models/LearningRule');
const Merchant = require('../models/Merchant'); // Global model — not deleted per-user
const ImportBatch = require('../models/ImportBatch');
const Payment = require('../models/Payment');
const PaymentAttempt = require('../models/PaymentAttempt');
const Bill = require('../models/Bill');
const Goal = require('../models/Goal');
const Analytics = require('../models/Analytics');
const Notification = require('../models/Notification');
const Feedback = require('../models/Feedback');
const SqlUserService = require('./SqlUserService');

class AccountDeletionService {
  /**
   * Verify user password before allowing deletion
   */
  async verifyPassword(userId, password) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.passwordHash) throw new Error('No password set for this account');

    const isValid = await user.matchPassword(password);
    if (!isValid) throw new Error('Incorrect password');

    return true;
  }

  /**
   * Execute full account deletion with progress tracking
   * Returns a step-by-step report of what was deleted
   */
  async deleteAccount(userId, password) {
    // 1. Verify password
    await this.verifyPassword(userId, password);

    const report = {
      userId,
      startedAt: new Date(),
      steps: [],
      totalDeleted: 0,
    };

    const step = (name, count) => {
      report.steps.push({ name, count, completedAt: new Date() });
      report.totalDeleted += count;
    };

    try {
      // 2. Get all account IDs for this user (needed for ledger/transaction queries)
      const accounts = await Account.find({ userId }).select('_id').lean();
      const accountIds = accounts.map(a => a._id);

      // ── PHASE 1: Financial data (order matters) ──

      // Ledger entries (source of truth for balance)
      const ledgerResult = await Ledger.deleteMany({
        $or: [
          { userId },
          { accountId: { $in: accountIds } },
        ],
      });
      step('Ledger entries', ledgerResult.deletedCount);

      // Clean up receipt files before deleting transactions
      const receipts = await Transaction.find({ userId, receiptUrl: { $ne: '' } })
        .select('receiptUrl')
        .lean();
      let filesDeleted = 0;
      for (const tx of receipts) {
        if (tx.receiptUrl) {
          try {
            const filePath = path.join(__dirname, '..', 'uploads', 'receipts', tx.receiptUrl);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              filesDeleted++;
            }
          } catch { /* best effort */ }
        }
      }
      step('Receipt files', filesDeleted);

      const user = await User.findById(userId).select('profile.avatar').lean();
      if (user?.profile?.avatar) {
        try {
          await require('./ProfileImageService').deleteProfileImage(user.profile.avatar);
          step('Profile avatar', 1);
        } catch {
          step('Profile avatar', 0);
        }
      }

      // Transactions
      const txResult = await Transaction.deleteMany({ userId });
      step('Transactions', txResult.deletedCount);

      // Import batches
      const importResult = await ImportBatch.deleteMany({ userId });
      step('Import batches', importResult.deletedCount);

      // ── PHASE 2: Payments ──

      const attemptResult = await PaymentAttempt.deleteMany({ userId });
      step('Payment attempts', attemptResult.deletedCount);

      const paymentResult = await Payment.deleteMany({ userId });
      step('Payments', paymentResult.deletedCount);

      // ── PHASE 3: Budgets & intelligence ──

      const budgetResult = await Budget.deleteMany({ userId });
      step('Budgets', budgetResult.deletedCount);

      const aiResult = await AILearning.deleteMany({ userId });
      step('AI learning data', aiResult.deletedCount);

      const ruleResult = await LearningRule.deleteMany({ userId });
      step('Learning rules', ruleResult.deletedCount);

      // Merchants are global/shared entities (no userId field) — not deleted per-user
      step('Merchants (global, skipped)', 0);

      // ── PHASE 4: Supporting data ──

      const feedbackResult = await Feedback.deleteMany({ userId });
      step('Feedback', feedbackResult.deletedCount);

      const billResult = await Bill.deleteMany({ userId });
      step('Bills', billResult.deletedCount);

      const goalResult = await Goal.deleteMany({ userId });
      step('Goals', goalResult.deletedCount);

      const analyticsResult = await Analytics.deleteMany({ userId });
      step('Analytics', analyticsResult.deletedCount);

      const notifResult = await Notification.deleteMany({ userId });
      step('Notifications', notifResult.deletedCount);

      // ── PHASE 5: Accounts ──

      const accountResult = await Account.deleteMany({ userId });
      step('Accounts', accountResult.deletedCount);

      // ── PHASE 6: Audit logs ──
      // Delete user's audit history FIRST, then create a final compliance receipt
      const auditResult = await AuditLog.deleteMany({ userId });
      step('Audit logs', auditResult.deletedCount);

      // ── PHASE 7: User document (final) ──

      const sqlResult = await SqlUserService.deleteByMongoUserId(userId);
      step('PostgreSQL user profile', sqlResult.count || 0);

      await User.deleteOne({ _id: userId });
      step('User account', 1);

      // Create a final compliance receipt AFTER deletion (userId is now orphaned,
      // but this log exists as proof the deletion was performed)
      try {
        await AuditLog.create({
          userId,
          action: 'ACCOUNT_DELETED',
          resourceType: 'user',
          resourceId: userId,
          newValue: {
            report: report.steps.map(s => ({ name: s.name, count: s.count })),
            totalDeleted: report.totalDeleted,
          },
          status: 'success',
        });
      } catch { /* compliance log is best-effort */ }

      report.completedAt = new Date();
      report.status = 'completed';
      report.durationMs = report.completedAt - report.startedAt;

      return report;

    } catch (error) {
      report.completedAt = new Date();
      report.status = 'failed';
      report.error = error.message;
      report.durationMs = report.completedAt - report.startedAt;

      // Log the failure
      try {
        await AuditLog.create({
          userId,
          action: 'ACCOUNT_DELETION_FAILED',
          resourceType: 'user',
          resourceId: userId,
          status: 'failure',
          errorMessage: error.message,
        });
      } catch { /* if audit also fails, nothing we can do */ }

      throw error;
    }
  }

  /**
   * Get a preview of what will be deleted (for the confirmation UI)
   */
  async getDeletionPreview(userId) {
    const accounts = await Account.find({ userId }).select('_id').lean();
    const accountIds = accounts.map(a => a._id);

    const [
      transactionCount,
      ledgerCount,
      importCount,
      paymentCount,
      attemptCount,
      budgetCount,
      aiCount,
      receiptCount,
      feedbackCount,
    ] = await Promise.all([
      Transaction.countDocuments({ userId }),
      Ledger.countDocuments({ $or: [{ userId }, { accountId: { $in: accountIds } }] }),
      ImportBatch.countDocuments({ userId }),
      Payment.countDocuments({ userId }),
      PaymentAttempt.countDocuments({ userId }),
      Budget.countDocuments({ userId }),
      AILearning.countDocuments({ userId }),
      Transaction.countDocuments({ userId, receiptUrl: { $ne: '' } }),
      Feedback.countDocuments({ userId }),
    ]);

    return {
      accounts: accounts.length,
      transactions: transactionCount,
      ledgerEntries: ledgerCount,
      importBatches: importCount,
      payments: paymentCount,
      paymentAttempts: attemptCount,
      budgets: budgetCount,
      aiLearningRecords: aiCount,
      receiptFiles: receiptCount,
      feedbackRecords: feedbackCount,
      total: transactionCount + ledgerCount + importCount + paymentCount +
             attemptCount + budgetCount + aiCount + feedbackCount + accounts.length,
    };
  }
}

module.exports = new AccountDeletionService();
