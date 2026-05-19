const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  billId: {
    type: String,
    required: true,
    unique: true,
  },
  billType: {
    type: String, // 'Electricity', 'Water', 'Internet'
    required: true,
  },
  billAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paymentDate: {
    type: Date,
  },
  paymentMethod: {
    type: String, // 'UPI', 'Cash', 'Bank Transfer'
  },
  vendorName: {
    type: String,
    required: true,
  },
  status: {
    type: String, // 'Paid', 'Unpaid', 'Pending'
    default: 'Unpaid',
  },
  receipt: {
    type: String,
    default: '',
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Bill', BillSchema);
