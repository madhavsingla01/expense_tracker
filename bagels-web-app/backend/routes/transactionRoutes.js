const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  duplicateTransaction,
  splitTransaction,
  runRecurringTransactions,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getTransactions)
  .post(protect, createTransaction);

router.post('/recurring/run', protect, runRecurringTransactions);

router.post('/:id/duplicate', protect, duplicateTransaction);
router.post('/:id/split', protect, splitTransaction);

router.route('/:id')
  .put(protect, updateTransaction)
  .delete(protect, deleteTransaction);

module.exports = router;
