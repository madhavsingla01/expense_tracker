const asyncHandler = require('express-async-handler');
const { BudgetService } = require('../services');

// @desc    Get all budgets for logged-in user
// @route   GET /api/budgets
// @access  Private
const getBudgets = asyncHandler(async (req, res) => {
  const budgets = await BudgetService.getBudgets(req.user._id);
  res.status(200).json(budgets);
});

// @desc    Create or update a budget
// @route   POST /api/budgets
// @access  Private
const upsertBudget = asyncHandler(async (req, res) => {
  const result = await BudgetService.upsertBudget(req.user._id, req.body);
  res.status(200).json(result);
});

// @desc    Delete a budget
// @route   DELETE /api/budgets/:id
// @access  Private
const deleteBudget = asyncHandler(async (req, res) => {
  const result = await BudgetService.deleteBudget(req.user._id, req.params.id);
  res.status(200).json(result);
});

module.exports = { getBudgets, upsertBudget, deleteBudget };

