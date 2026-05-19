const express = require('express');
const router = express.Router();
const { getAccounts, addUpiAccount, removeAccount, setDefaultAccount } = require('../controllers/accountController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAccounts)
  .post(protect, addUpiAccount);

router.route('/:id')
  .delete(protect, removeAccount);

router.put('/:id/default', protect, setDefaultAccount);

module.exports = router;
