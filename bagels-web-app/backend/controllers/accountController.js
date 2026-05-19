const asyncHandler = require('express-async-handler');
const { AccountService } = require('../services');

const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await AccountService.getAccountsByUser(req.user._id);
  res.json(accounts);
});

const addUpiAccount = asyncHandler(async (req, res) => {
  const { provider, upiId } = req.body;
  if (!provider || !upiId) {
    res.status(400);
    throw new Error('Provider and upiId are required');
  }
  const account = await AccountService.addUpiAccount(req.user._id, provider, upiId);
  res.status(201).json(account);
});

const removeAccount = asyncHandler(async (req, res) => {
  await AccountService.removeAccount(req.user._id, req.params.id);
  res.json({ success: true });
});

const setDefaultAccount = asyncHandler(async (req, res) => {
  const account = await AccountService.setDefaultAccount(req.user._id, req.params.id);
  res.json(account);
});

module.exports = { getAccounts, addUpiAccount, removeAccount, setDefaultAccount };
