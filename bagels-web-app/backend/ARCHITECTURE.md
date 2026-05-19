# Backend Architecture - Service Layer Implementation

## Overview

Your backend is now properly structured with clear separation of concerns:

```
Request → Route → Controller → Service → Model → Database
                                 ↓
                            Validation
                            Business Logic
                            Data Transformation
```

Current persistence split:

- MongoDB/Mongoose remains the primary database for existing expense, ledger, payment, budget, admin, and auth-session data.
- PostgreSQL/Prisma stores the basic SQL user profile mirror and Cloudinary upload metadata.
- Multer receives multipart uploads; Cloudinary stores profile images; Prisma stores Cloudinary URLs and public IDs.

## Structure

### 📁 Controllers (Lean)
**Location:** `backend/controllers/`

Controllers now:
- ✅ Extract data from request
- ✅ Call appropriate service
- ✅ Return response
- ❌ NO validation
- ❌ NO database operations
- ❌ NO business logic

**Example:**
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

### 🔧 Services (Business Logic)
**Location:** `backend/services/`

Services handle:
- ✅ Input validation
- ✅ Business logic
- ✅ Database operations
- ✅ Data transformation
- ✅ Error handling

**Services Created:**

#### 1. UserService
Handles: Registration, login, profile updates, auth
```js
await UserService.registerUser({ name, email, password, ... });
await UserService.loginUser(email, password);
await UserService.updateUserProfile(userId, updateData);
```

#### 1.1 SqlUserService
Handles: PostgreSQL user profile sync and Cloudinary upload metadata through Prisma
```js
await SqlUserService.upsertFromMongoUser(user);
await SqlUserService.recordUploadForMongoUser(user, file, uploadResult);
await SqlUserService.updateAvatarForMongoUser(user, avatarUrl, avatarPublicId);
```

#### 1.2 CloudinaryStorageService
Handles: Cloudinary image upload and deletion
```js
await CloudinaryStorageService.uploadProfileImage(userId, file);
await CloudinaryStorageService.deleteByUrl(avatarUrl);
```

#### 2. TransactionService
Handles: Create/delete transactions, validation, ledger entries
```js
await TransactionService.createExpenseTransaction(userId, accountId, data);
await TransactionService.createIncomeTransaction(userId, accountId, data);
await TransactionService.deleteTransaction(userId, transactionId);
await TransactionService.getTransactions(userId);
```

#### 3. BudgetService
Handles: Budget CRUD, spent tracking, alerts
```js
await BudgetService.upsertBudget(userId, { category, limit });
await BudgetService.getBudgets(userId);
await BudgetService.updateBudgetSpent(userId, category, amount);
await BudgetService.checkBudgetAlerts(userId, category);
```

#### 4. MerchantService
Handles: Merchant normalization, deduplication, search
```js
await MerchantService.findOrCreateMerchant(name, category, confidence);
await MerchantService.searchMerchants(searchTerm);
await MerchantService.addAlternateNames(merchantId, names);
```

#### 5. ValidationService
Centralized validation functions:
```js
validateEmail(email);
validatePassword(password);
validateAmount(amount);
validateRequiredField(value, fieldName);
validateEnum(value, enumArray, fieldName);
validateDate(dateString);
validatePhoneNumber(phone);
```

## Data Flow Examples

### Creating an Expense Transaction

```
Client Request
   ↓
Route: POST /api/transactions
   ↓
TransactionController.createTransaction()
   ├─ req.user._id (from auth middleware)
   ├─ req.body.accountId
   └─ req.body (all transaction data)
   ↓
TransactionService.createExpenseTransaction()
   ├─ validateTransactionInput()
   ├─ validateAmount()
   ├─ saveReceiptImage()
   ├─ MerchantService.findOrCreateMerchant()
   ├─ Transaction.create() (DB)
   ├─ createLedgerEntry() (DB)
   ├─ AuditLog.create() (DB)
   ├─ storeAILearning() (DB)
   └─ formatTransactionResponse()
   ↓
Controller sends response
   ↓
Client receives formatted transaction
```

### Updating Budget After Transaction

```
TransactionController.createTransaction()
   ↓
TransactionService.createExpenseTransaction()
   ├─ Create transaction
   └─ Return result
   ↓
Controller calls BudgetService.updateBudgetSpent()
   ├─ Find budget for this category/month
   ├─ Calculate new spent amount
   ├─ Generate alerts (50%, 75%, 90%, 100%)
   ├─ Save to Budget (DB)
   └─ Return
   ↓
Controller sends transaction response
```

## Key Principles Applied

### 1. Single Responsibility
- Each service has ONE job
- Each controller is just a dispatcher
- Each model is just a schema

### 2. Validation First
All services validate input BEFORE database operations:
```js
validateTransactionInput(data);
validateAmount(amount);
validateRequiredField(category, 'Category');
```

### 3. Audit Trail
Important operations logged to AuditLog:
```js
await AuditLog.create({
  userId,
  action: 'CREATE_TRANSACTION',
  resourceType: 'transaction',
  resourceId: transaction._id,
  newValue: transaction,
  status: 'success'
});
```

### 4. Ledger as Source of Truth
Every financial transaction creates a ledger entry:
```js
await createLedgerEntry(userId, accountId, transactionId, 'debit', amount);
// This updates Account.balance and maintains audit trail
```

### 5. Merchant Deduplication
AI-ready merchant handling:
```js
const merchant = await MerchantService.findOrCreateMerchant(
  'ZOMATO LTD',      // Input
  'food',            // Category
  0.8                // Confidence
);
// Stores as: normalizedName: 'zomato', prevents duplicates
```

## Error Handling

Services throw `ValidationError` for input issues:
```js
const { ValidationError, validateEmail } = require('./ValidationService');

try {
  validateEmail(email); // Throws if invalid
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Field:', error.field);
    console.log('Message:', error.message);
  }
}
```

Controller passes to asyncHandler which handles it:
```js
const createTransaction = asyncHandler(async (req, res) => {
  // If service throws, asyncHandler catches it
  const result = await TransactionService.create(...);
  res.json(result);
});
```

## Testing This Layer

### ✅ What to Test

1. **Service Methods** (no dependencies on controllers)
```js
const result = await UserService.registerUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'securePassword123'
});
expect(result.email).toBe('john@example.com');
expect(result.token).toBeDefined();
```

2. **Validation** (reject invalid inputs)
```js
expect(() => validateAmount(-100)).toThrow(ValidationError);
expect(() => validateEmail('invalid')).toThrow(ValidationError);
```

3. **API Endpoints** (through controllers)
```js
POST /api/transactions
  Body: { amount: -100, category: 'food' }
  Expected: 400 Bad Request (validation error)
```

4. **Data Integrity** (transaction + ledger)
```js
const transaction = await TransactionService.createExpenseTransaction(...);
const ledgerEntry = await Ledger.findOne({ transactionId: transaction._id });
expect(ledgerEntry).toBeDefined();
expect(ledgerEntry.balanceAfter).toEqual(expectedBalance);
```

## Service Usage Checklist

- [x] UserService - Auth, profiles, preferences
- [x] TransactionService - Create, delete, list transactions
- [x] BudgetService - Budget CRUD and tracking
- [x] MerchantService - Merchant deduplication
- [x] ValidationService - Centralized validation

## Next Steps

1. **Test the API endpoints** with invalid inputs
2. **Verify ledger entries** are created for transactions
3. **Check audit logs** for all operations
4. **Test budget alerts** trigger correctly
5. **Add routes** for new endpoints (delete budget, etc.)

---

**Last Updated:** 2026-04-25
**Architecture Pattern:** Service Layer with Validation Layer
