require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bagels', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to DB');

  const ledgers = mongoose.connection.db.collection('ledgers');
  const transactions = mongoose.connection.db.collection('transactions');

  // 1. Migrate Ledgers
  const allLedgers = await ledgers.find().sort({ createdAt: 1 }).toArray();
  let currentBalance = 0;
  for (const l of allLedgers) {
    let amtStr = l.amount ? l.amount.toString() : '0';
    let amt = parseFloat(amtStr);
    if (isNaN(amt)) amt = 0;
    
    // Some old ledgers might not have type, fallback to expense
    const type = l.type || 'expense';
    let debit = 0;
    let credit = 0;
    if (type === 'expense' || type === 'debit') {
      debit = amt;
      currentBalance -= amt;
    } else {
      credit = amt;
      currentBalance += amt;
    }
    
    await ledgers.updateOne(
      { _id: l._id },
      { 
        $set: { 
          debit: mongoose.Types.Decimal128.fromString(debit.toString()), 
          credit: mongoose.Types.Decimal128.fromString(credit.toString()), 
          balanceAfter: mongoose.Types.Decimal128.fromString(currentBalance.toString()),
          entryType: 'normal'
        },
        $unset: { amount: "", type: "" }
      }
    );
  }
  console.log('Migrated Ledgers');

  // 2. Migrate Transactions
  const allTxns = await transactions.find().sort({ date: 1, createdAt: 1 }).toArray();
  currentBalance = 0;
  for (const t of allTxns) {
    let amtStr = t.amount ? t.amount.toString() : '0';
    let amt = parseFloat(amtStr);
    if (isNaN(amt)) amt = 0;

    const type = t.type || (t.category === 'income' ? 'income' : 'expense');
    let debit = 0;
    let credit = 0;
    if (type === 'expense') {
      debit = amt;
      currentBalance -= amt;
    } else {
      credit = amt;
      currentBalance += amt;
    }

    await transactions.updateOne(
      { _id: t._id },
      { 
        $set: { 
          debit: mongoose.Types.Decimal128.fromString(debit.toString()), 
          credit: mongoose.Types.Decimal128.fromString(credit.toString()), 
          balanceAfter: mongoose.Types.Decimal128.fromString(currentBalance.toString()),
          type: type // ensure type is set correctly
        },
        $unset: { amount: "" }
      }
    );
  }
  console.log('Migrated Transactions');

  console.log('Migration complete. Current running balance:', currentBalance);
  process.exit(0);
}

migrate().catch(console.error);
