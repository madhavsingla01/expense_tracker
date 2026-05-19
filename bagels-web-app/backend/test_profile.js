const mongoose = require('mongoose');
const UserService = require('./services/UserService');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect('mongodb://127.0.0.1/bagels').then(async () => {
  try {
    const user = await User.findOne();
    if (!user) {
      console.log('No user found');
      process.exit(0);
    }
    
    console.log('Found user:', user._id);
    const updateData = {
      name: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
      phone: '',
      preferredCurrency: 'INR',
      spendingCategories: user.spendingCategories,
      savedContacts: user.savedContacts || []
    };
    
    console.log('Attempting update with:', updateData);
    const result = await UserService.updateUserProfile(user._id, updateData);
    console.log('Success:', result);
  } catch (error) {
    console.error('Update failed:', error);
  }
  process.exit(0);
});
