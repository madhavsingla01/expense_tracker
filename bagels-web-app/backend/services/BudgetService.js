/**
 * Budget Service
 * Handles budget creation, updates, and calculations
 */

const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const AuditLog = require('../models/AuditLog');
const { ValidationError, validateAmount, validateRequiredField } = require('./ValidationService');

class BudgetService {
  /**
   * Format budget for response
   */
  formatBudgetResponse(budget) {
    const toNum = (dec) => (dec ? parseFloat(dec.toString()) : 0);

    return {
      _id: budget._id,
      category: budget.category,
      limit: toNum(budget.budgetAmount),
      spent: toNum(budget.spent),
      remaining: toNum(budget.remaining),
      percentUsed: (toNum(budget.spent) / toNum(budget.budgetAmount)) * 100,
      alerts: budget.alerts || [],
    };
  }

  /**
   * Get current month date range
   */
  getCurrentMonthRange() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startDate, endDate };
  }

  /**
   * Create or update budget for current month
   */
  async upsertBudget(userId, budgetData) {
    const { category, limit } = budgetData;

    validateRequiredField(category, 'Category');
    validateAmount(limit);

    const { startDate, endDate } = this.getCurrentMonthRange();

    // Check if budget exists
    let budget = await Budget.findOne({
      userId,
      category,
      startDate,
      endDate,
    });
    const wasExisting = Boolean(budget);

    if (budget) {
      // Update existing
      budget.budgetAmount = limit;
      budget.remaining = Math.max(0, parseFloat(limit.toString()) - parseFloat(budget.spent?.toString() || 0));
      budget.alertEnabled = true;
      budget.alerts = this.generateAlerts(limit, budget.spent || 0);
    } else {
      // Create new
      budget = new Budget({
        userId,
        category,
        budgetAmount: limit,
        spent: 0,
        remaining: limit,
        startDate,
        endDate,
        alertEnabled: true,
        alerts: this.generateAlerts(limit, 0),
      });
    }

    await budget.save();

    await AuditLog.create({
      userId,
      action: wasExisting ? 'UPDATE_BUDGET' : 'CREATE_BUDGET',
      resourceType: 'budget',
      resourceId: budget._id,
      newValue: budget,
      status: 'success',
    });

    return this.formatBudgetResponse(budget);
  }

  /**
   * Get all budgets for user
   */
  async getBudgets(userId) {
    const budgets = await Budget.find({ userId }).lean();
    return budgets.map((b) => this.formatBudgetResponse(b));
  }

  /**
   * Get budget for specific category in current month
   */
  async getBudgetByCategory(userId, category) {
    const { startDate, endDate } = this.getCurrentMonthRange();

    const budget = await Budget.findOne({
      userId,
      category,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    if (!budget) return null;

    return this.formatBudgetResponse(budget);
  }

  /**
   * Calculate spent amount for category in date range
   */
  async calculateSpent(userId, category, startDate, endDate) {
    const transactions = await Transaction.find({
      userId,
      category,
      date: { $gte: startDate, $lte: endDate },
      type: 'expense',
      status: 'success',
    }).lean();

    const total = transactions.reduce((sum, t) => {
      return sum + parseFloat(t.debit?.toString() || 0);
    }, 0);

    return total;
  }

  /**
   * Generate alert thresholds
   */
  generateAlerts(budgetAmount, spent) {
    const thresholds = [50, 75, 90, 100];
    const budgetNum = parseFloat(budgetAmount.toString() || 0);
    const spentNum = parseFloat(spent.toString() || 0);

    return thresholds.map((percent) => {
      const threshold = (budgetNum * percent) / 100;
      return {
        percent,
        triggered: spentNum >= threshold,
        triggeredAt: spentNum >= threshold ? new Date() : null,
      };
    });
  }

  /**
   * Update spent amount for budget
   * Called after transaction creation
   */
  async updateBudgetSpent(userId, category, amount) {
    const { startDate, endDate } = this.getCurrentMonthRange();

    const budget = await Budget.findOne({
      userId,
      category,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    if (!budget) return; // No budget set for this category

    const newSpent = parseFloat(budget.spent.toString() || 0) + parseFloat(amount.toString());
    const remaining = parseFloat(budget.budgetAmount.toString()) - newSpent;

    budget.spent = newSpent;
    budget.remaining = Math.max(0, remaining);
    budget.alerts = this.generateAlerts(budget.budgetAmount, newSpent);

    await budget.save();
  }

  /**
   * Reverse transaction amount from budget
   * Called after transaction deletion
   */
  async reverseBudgetAmount(userId, category, amount) {
    const { startDate, endDate } = this.getCurrentMonthRange();

    const budget = await Budget.findOne({
      userId,
      category,
      startDate,
      endDate,
    });

    if (!budget) return;

    const newSpent = Math.max(0, parseFloat(budget.spent.toString()) - parseFloat(amount.toString()));
    const remaining = parseFloat(budget.budgetAmount.toString()) - newSpent;

    budget.spent = newSpent;
    budget.remaining = remaining;
    budget.alerts = this.generateAlerts(budget.budgetAmount, newSpent);

    await budget.save();
  }

  /**
   * Check if any alerts should be triggered
   */
  async checkBudgetAlerts(userId, category) {
    const budget = await this.getBudgetByCategory(userId, category);

    if (!budget || !budget.alerts) return [];

    return budget.alerts.filter((alert) => alert.triggered && !alert.triggeredAt);
  }

  /**
   * Delete budget
   */
  async deleteBudget(userId, budgetId) {
    const budget = await Budget.findOne({ _id: budgetId, userId });

    if (!budget) {
      throw new Error('Budget not found');
    }

    const oldValue = budget.toObject();

    await Budget.findByIdAndDelete(budgetId);

    await AuditLog.create({
      userId,
      action: 'DELETE_BUDGET',
      resourceType: 'budget',
      resourceId: budgetId,
      oldValue,
      status: 'success',
    });

    return { success: true };
  }
}

module.exports = new BudgetService();
