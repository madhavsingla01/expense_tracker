const asyncHandler = require('express-async-handler');
const { TransactionService, AccountService, TransactionIngestionService } = require('../services');
const { broadcastTransactionChange } = require('../utils/paymentSocketServer');

// @desc    Get all transactions (merged from Transactions and Income)
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const transactions = await TransactionService.getTransactions(req.user._id, req.query);
  res.status(200).json(transactions);
});

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  let accountId = req.body.accountId;
  
  if (!accountId || accountId === 'default') {
    const primaryAccount = await AccountService.getPrimaryAccount(req.user._id);
    accountId = primaryAccount._id;
  }
  
  const ingestion = await TransactionIngestionService.ingestOne(req.user._id, accountId, req.body, {
    source: req.body.source || 'manual',
  });

  if (ingestion.status === 'duplicate') {
    res.status(409);
    res.json({
      status: 'duplicate',
      message: 'Duplicate transaction detected for the same date, amount, and merchant.',
      duplicateTransactionId: ingestion.duplicateTransactionId,
    });
    return;
  }

  const result = ingestion.transaction;
  broadcastTransactionChange(req.user._id, {
    action: 'created',
    transactionId: result.id || result._id,
    transaction: result,
  });
  res.status(201).json(result);
});

// @desc    Update a transaction (category correction triggers feedback loop)
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = asyncHandler(async (req, res) => {
  const result = await TransactionService.updateTransaction(req.user._id, req.params.id, req.body);
  broadcastTransactionChange(req.user._id, {
    action: 'updated',
    transactionId: result.id || result._id,
    transaction: result,
  });
  res.status(200).json(result);
});

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = asyncHandler(async (req, res) => {
  await TransactionService.deleteTransaction(req.user._id, req.params.id);
  broadcastTransactionChange(req.user._id, {
    action: 'deleted',
    transactionId: req.params.id,
  });
  res.status(200).json({ id: req.params.id });
});

const duplicateTransaction = asyncHandler(async (req, res) => {
  const result = await TransactionService.duplicateTransaction(req.user._id, req.params.id, req.body || {});
  broadcastTransactionChange(req.user._id, {
    action: 'created',
    transactionId: result.id || result._id,
    transaction: result,
  });
  res.status(201).json(result);
});

const splitTransaction = asyncHandler(async (req, res) => {
  const result = await TransactionService.splitTransaction(req.user._id, req.params.id, req.body.splits);
  broadcastTransactionChange(req.user._id, {
    action: 'split',
    transactionId: req.params.id,
    transactions: result.transactions,
  });
  res.status(201).json(result);
});

const runRecurringTransactions = asyncHandler(async (req, res) => {
  const result = await TransactionService.runDueRecurringTransactions(req.user._id, req.body.until ? new Date(req.body.until) : new Date());
  if (result.length > 0) {
    broadcastTransactionChange(req.user._id, {
      action: 'recurring.created',
      transactions: result,
    });
  }
  res.status(201).json(result);
});

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  duplicateTransaction,
  splitTransaction,
  runRecurringTransactions,
};
