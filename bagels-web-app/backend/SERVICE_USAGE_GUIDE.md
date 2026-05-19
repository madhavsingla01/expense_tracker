# Quick Reference - Service Layer Usage

## For Backend Developers

### When to Add New Functionality

**WRONG ❌** - Logic in Controller:
```js
app.post('/api/transactions', async (req, res) => {
  // DON'T DO THIS
  const transaction = new Transaction(req.body);
  const saved = await transaction.save();
  res.json(saved);
});
```

**RIGHT ✅** - Logic in Service:
```js
// Controller
const createTransaction = asyncHandler(async (req, res) => {
  const result = await TransactionService.create(req.user._id, req.body);
  res.status(201).json(result);
});

// Service
async create(userId, data) {
  validateInput(data);
  const processed = processData(data);
  return await Transaction.create(processed);
}
```

---

## Adding a New Feature

### Example: "Create Expense" Feature

#### Step 1: Add to Service

**File:** `services/TransactionService.js`
```js
async createExpenseTransaction(userId, accountId, data) {
  // 1. VALIDATE
  this.validateTransactionInput(data);
  const amount = validateAmount(data.amount);

  // 2. PROCESS
  const merchant = await MerchantService.findOrCreateMerchant(...);
  const receipt = this.saveReceiptImage(data.receiptImage);

  // 3. SAVE
  const transaction = await Transaction.create({ ... });

  // 4. SIDE EFFECTS
  await this.createLedgerEntry(...);
  await AuditLog.create(...);

  // 5. RETURN
  return this.formatTransactionResponse(transaction);
}
```

#### Step 2: Call from Controller

**File:** `controllers/transactionController.js`
```js
const createTransaction = asyncHandler(async (req, res) => {
  const result = await TransactionService.createExpenseTransaction(
    req.user._id,
    req.body.accountId,
    req.body
  );
  res.status(201).json(result);
});
```

#### Step 3: Add Route

**File:** `routes/transactions.js`
```js
router.post('/', authenticate, createTransaction);
```

Done! No validation, no DB ops, no logic in controller.

---

## Service Method Patterns

### Pattern 1: Create with Validation
```js
async create(userId, data) {
  // Validate first
  validateInput(data);
  
  // Check for duplicates
  const existing = await Model.findOne({ userId, ... });
  if (existing) throw new ValidationError('Already exists');
  
  // Create
  const result = await Model.create({ userId, ...data });
  
  // Log
  await AuditLog.create({ userId, action: 'CREATE', ... });
  
  return this.format(result);
}
```

### Pattern 2: Update with Audit
```js
async update(userId, id, data) {
  // Get existing
  const existing = await Model.findOne({ _id: id, userId });
  if (!existing) throw new Error('Not found');
  
  // Store for audit
  const oldValue = existing.toObject();
  
  // Update
  Object.assign(existing, data);
  await existing.save();
  
  // Log changes
  await AuditLog.create({
    userId,
    action: 'UPDATE',
    oldValue,
    newValue: existing,
  });
  
  return this.format(existing);
}
```

### Pattern 3: Delete with Reversal
```js
async delete(userId, id) {
  // Get existing
  const existing = await Model.findOne({ _id: id, userId });
  if (!existing) throw new Error('Not found');
  
  // Reverse side effects
  if (existing.ledgerId) {
    await Ledger.findByIdAndDelete(existing.ledgerId);
  }
  
  // Delete
  await Model.findByIdAndDelete(id);
  
  // Log
  await AuditLog.create({
    userId,
    action: 'DELETE',
    oldValue: existing,
  });
  
  return { success: true };
}
```

### Pattern 4: Validation Wrapper
```js
validateInput(data) {
  const { field1, field2 } = data;
  
  validateRequiredField(field1, 'Field 1');
  validateEnum(field2, ['option1', 'option2'], 'Field 2');
  validateAmount(data.amount);
  
  // If any validation fails, throws ValidationError
  // Controller doesn't need to catch it—asyncHandler does
}
```

---

## Common Operations

### Validate Amount
```js
const { validateAmount } = require('../services/ValidationService');

try {
  const num = validateAmount(userInput);
  // Use num (guaranteed > 0)
} catch (error) {
  // error.field === 'amount'
  // error.message === 'Amount must be a positive number'
}
```

### Find or Create Merchant
```js
const merchant = await MerchantService.findOrCreateMerchant(
  'Zomato',      // Will be normalized to 'zomato'
  'food',        // Category
  0.9            // Confidence score
);
// Returns existing if normalized name matches
// Creates new if not found
```

### Create Ledger Entry
```js
await TransactionService.createLedgerEntry(
  userId,
  accountId,
  transactionId,
  'debit',       // 'debit' | 'credit'
  1000          // Amount
);
// Automatically:
// - Calculates new balance
// - Saves ledger entry
// - Updates Account.balance
```

### Log to Audit Trail
```js
await AuditLog.create({
  userId,
  action: 'DELETE_TRANSACTION',
  resourceType: 'transaction',
  resourceId: transactionId,
  oldValue: transaction.toObject(),
  newValue: null,
  status: 'success',
  ip: req.ip,
  userAgent: req.get('user-agent'),
});
```

---

## Error Handling

### Throwing Validation Errors
```js
const { ValidationError } = require('../services/ValidationService');

// In service
if (amount <= 0) {
  throw new ValidationError('Amount must be positive', 'amount');
}

// In controller—asyncHandler catches automatically
const createTransaction = asyncHandler(async (req, res) => {
  // If validateAmount throws ValidationError,
  // asyncHandler catches it and returns 400
  const result = await TransactionService.create(...);
  res.json(result);
});
```

### Custom Error Messages
```js
if (!email.includes('@')) {
  throw new ValidationError('Invalid email format', 'email');
}
// Error.message: 'Invalid email format'
// Error.field: 'email'
// Error.name: 'ValidationError'
```

---

## Testing Services

### Test a Service in Isolation
```js
const { UserService } = require('../services');

// No controller needed
const user = await UserService.registerUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'securePassword123'
});

expect(user.email).toBe('john@example.com');
expect(user.token).toBeDefined();
```

### Test Validation
```js
const { ValidationError, validateAmount } = require('../services/ValidationService');

expect(() => validateAmount(-100)).toThrow(ValidationError);
expect(() => validateAmount('abc')).toThrow(ValidationError);
```

---

## Checklist: Before Merging

- [ ] Service method validates input
- [ ] Service method doesn't expose DB details
- [ ] Controller is 3-5 lines only
- [ ] AuditLog created for important actions
- [ ] Ledger entry created for financial transactions
- [ ] Error messages are clear
- [ ] No database operations in controller
- [ ] Tests pass for edge cases

---

**Remember:**
- **Controllers** = Thin dispatchers
- **Services** = Fat business logic
- **Models** = Skinny schemas
- **Validation** = Happens in service, not controller
