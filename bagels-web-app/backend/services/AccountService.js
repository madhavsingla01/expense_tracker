const Account = require('../models/Account');

class AccountService {
  async getAccountsByUser(userId) {
    return await Account.find({ userId }).sort({ linkedOn: -1 }).lean();
  }

  async addUpiAccount(userId, provider, upiId) {
    const existing = await Account.countDocuments({ userId });
    const isDefault = existing === 0;

    const account = await Account.create({
      userId,
      type: 'upi',
      provider,
      upiId,
      isDefault
    });
    return account;
  }

  async removeAccount(userId, accountId) {
    const account = await Account.findOne({ _id: accountId, userId });
    if (!account) throw new Error('Account not found');
    
    await Account.findByIdAndDelete(accountId);

    if (account.isDefault) {
      // Set another account as default if exists
      const another = await Account.findOne({ userId });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }
  }

  async setDefaultAccount(userId, accountId) {
    await Account.updateMany({ userId }, { isDefault: false });
    const account = await Account.findOneAndUpdate(
      { _id: accountId, userId },
      { isDefault: true },
      { new: true }
    );
    if (!account) throw new Error('Account not found');
    return account;
  }

  async getPrimaryAccount(userId) {
    let account = await Account.findOne({ userId, isDefault: true });
    if (!account) {
      account = await Account.findOne({ userId });
    }
    if (!account) {
      account = await this.createDefaultAccount(userId);
    }
    return account;
  }

  async createDefaultAccount(userId) {
    const account = await Account.create({
      userId,
      type: 'bank',
      provider: 'Default Bank',
      isDefault: true
    });
    return account;
  }
}

module.exports = new AccountService();
