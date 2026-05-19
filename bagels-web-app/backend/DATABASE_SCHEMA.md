# Database Schema Documentation

## Overview
MongoDB remains the primary fintech expense tracking database with multi-account support, AI learning, and full audit capabilities.

PostgreSQL is added through Prisma for basic SQL user profile storage and Cloudinary upload metadata. This keeps the existing MongoDB data model intact while satisfying SQL-backed user/file persistence.

Prisma files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260519000000_init/migration.sql`
- `backend/config/prisma.js`
- `backend/services/SqlUserService.js`

---

## SQL: USER

**Purpose:** Basic SQL user profile mirror from MongoDB auth/profile data

```
users {
  id                  text primary key
  mongo_user_id       text unique
  email               text unique
  name                text
  first_name          text
  last_name           text
  phone               text
  preferred_currency  text default 'INR'
  avatar_url          text
  avatar_public_id    text
  email_verified      boolean default false
  kyc_status          text default 'pending'
  created_at          timestamp
  updated_at          timestamp
}
```

## SQL: UPLOADED_FILE

**Purpose:** Cloudinary file metadata linked to SQL user records

```
uploaded_files {
  id                    text primary key
  user_id               text references users(id)
  cloudinary_public_id  text unique
  url                   text
  secure_url            text
  resource_type         text default 'image'
  format                text
  bytes                 integer
  width                 integer
  height                integer
  folder                text
  original_name         text
  mime_type             text
  upload_type           text default 'profile_avatar'
  created_at            timestamp
  updated_at            timestamp
}
```

---

## 1. USER
**Purpose:** User accounts with authentication & KYC tracking

```
{
  _id: ObjectId,
  email: String (unique, lowercase),
  phoneNumber: String,
  passwordHash: String,
  
  auth: {
    refreshTokens: [{
      token: String,
      deviceId: String,
      expiresAt: Date,
      createdAt: Date
    }],
    devices: [{
      deviceId: String,
      deviceName: String,
      osType: String,
      lastLoginAt: Date,
      ipAddress: String
    }]
  },
  
  kycStatus: 'pending' | 'verified' | 'rejected',
  
  profile: {
    firstName: String,
    lastName: String,
    currency: String (default: 'INR'),
    dateOfBirth: Date,
    avatar: String
  },
  
  preferences: {
    notificationEnabled: Boolean,
    darkMode: Boolean
  },
  
  savedContacts: [{
    name: String,
    upiId: String
  }],
  
  spendingCategories: [String],
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 2. ACCOUNT ⭐ NEW
**Purpose:** Multi-source payment accounts (Bank, Wallet, UPI)

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  
  type: 'bank' | 'wallet' | 'upi',
  provider: String ('HDFC', 'Paytm', 'GPay', etc.),
  
  balance: Decimal128,
  currency: String (default: 'INR'),
  status: 'active' | 'inactive' | 'blocked',
  
  accountNumber: String,
  upiId: String,
  linkedOn: Date,
  
  createdAt: Date,
  updatedAt: Date
}

Index: { userId: 1, provider: 1, type: 1 } (unique)
```

**Use Case:**
- Link bank accounts, digital wallets, UPI
- Track balance per account
- Route transactions to specific accounts

---

## 3. TRANSACTION (REDESIGNED)
**Purpose:** All financial transactions with full metadata

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  accountId: ObjectId (ref: Account),
  
  type: 'expense' | 'income' | 'transfer',
  subType: 'upi' | 'card' | 'cash' | 'bank' | 'wallet',
  
  amount: Decimal128,
  currency: String,
  
  merchantId: ObjectId (ref: Merchant),
  category: String,
  tags: [String],
  
  status: 'pending' | 'success' | 'failed',
  source: 'manual' | 'ocr' | 'bank_sync',
  
  receiptUrl: String,
  
  meta: {
    upiId: String,
    note: String,
    location: {
      latitude: Decimal128,
      longitude: Decimal128
    }
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Improvements:**
- Cleaner field names
- Links to Account & Merchant
- Flexible metadata structure

---

## 4. MERCHANT ⭐ NEW
**Purpose:** Centralized merchant database for deduplication

```
{
  _id: ObjectId,
  
  name: String,
  normalizedName: String (unique, lowercase),
  
  category: String,
  confidenceScore: Number (0-1),
  
  alternateNames: [String],
  logo: String,
  website: String,
  
  createdAt: Date,
  updatedAt: Date
}

Index: { normalizedName: 1 } (unique)
```

**Why Important:**
- Avoid duplicates: "zomato", "ZOMATO", "zomato.com"
- Enable AI categorization
- Clean analytics
- Better reporting

**Example Flow:**
1. User enters "ZOMATO LTD"
2. Normalize → "zomato"
3. Find or create merchant with confidence score
4. Link transaction to merchant

---

## 5. LEDGER 🔥 FINTECH CORE
**Purpose:** Financial source of truth (double-entry bookkeeping)

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  accountId: ObjectId (ref: Account),
  transactionId: ObjectId (ref: Transaction),
  
  type: 'debit' | 'credit',
  amount: Decimal128,
  
  balanceAfter: Decimal128,
  description: String,
  reference: String,
  
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { userId: 1, accountId: 1, createdAt: -1 }
- { accountId: 1, createdAt: -1 }
```

**Critical Rules:**
- ✅ ALWAYS create ledger entry when transaction succeeds
- ✅ Track balance after EVERY entry
- ✅ Never trust transaction table alone
- ✅ Audit trail for reconciliation

**Example:**
```
Account balance: 10,000

Transaction: Expense of 2,000
→ Ledger entry: type='debit', amount=2000, balanceAfter=8000

Transaction: Income of 5,000
→ Ledger entry: type='credit', amount=5000, balanceAfter=13000
```

---

## 6. AUDIT LOG ⭐ NEW
**Purpose:** Compliance & security audit trail

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  
  action: String ('DELETE_TRANSACTION', 'UPDATE_BUDGET', etc.),
  resourceType: String ('transaction', 'budget', 'account', etc.),
  resourceId: ObjectId,
  
  oldValue: Mixed,
  newValue: Mixed,
  
  ip: String,
  device: String,
  userAgent: String,
  
  status: 'success' | 'failure',
  errorMessage: String,
  
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { userId: 1, createdAt: -1 }
- { action: 1, createdAt: -1 }
- { resourceType: 1, resourceId: 1 }
```

**Use Cases:**
- Who deleted which transaction?
- Compliance reports
- Fraud detection
- Security investigations

---

## 7. BUDGET (IMPROVED)
**Purpose:** Monthly spending limits with alerts

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  
  category: String,
  budgetAmount: Decimal128,
  
  spent: Decimal128,
  remaining: Decimal128,
  
  startDate: Date,
  endDate: Date,
  
  alertEnabled: Boolean,
  alerts: [{
    percent: Number (e.g., 80),
    triggered: Boolean,
    triggeredAt: Date
  }],
  
  createdAt: Date,
  updatedAt: Date
}

Index: { userId: 1, category: 1, startDate: 1, endDate: 1 } (unique)
```

**New Fields:**
- `spent`: Auto-calculated from ledger
- `remaining`: budgetAmount - spent
- `alerts`: Trigger at 50%, 75%, 90%, 100%

---

## 8. AI_LEARNING ⭐ NEW
**Purpose:** Train ML model for smart categorization

```
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  
  input: String (e.g., "dominos pizza", lowercase),
  predictedCategory: String,
  
  confidence: Number (0-1),
  timesUsed: Number,
  lastUsedAt: Date,
  
  correct: Boolean | null,
  
  createdAt: Date,
  updatedAt: Date
}

Index: { userId: 1, input: 1 } (unique)
```

**Training Data Pipeline:**
1. User enters merchant name
2. AI predicts category
3. User confirms/corrects
4. Store (input, correctCategory, confidence)
5. Retrain model with better data

---

## Migration Strategy

### Phase 1: Add New Collections
- [x] Create Account
- [x] Create Merchant
- [x] Create Ledger
- [x] Create AuditLog
- [x] Create AILearning

### Phase 2: Update Existing
- [x] User: Add auth, kycStatus
- [x] Transaction: Rename fields, add accountId, merchantId
- [x] Budget: Add spent, remaining, alerts

### Phase 3: Data Migration (To Run)
```js
// 1. Create default accounts from User.linkedAccounts
// 2. Link existing transactions to accounts
// 3. Backfill merchant data
// 4. Create ledger entries from transactions
// 5. Migrate budgets with calculations
```

---

## Best Practices

### ✅ DO
- Always create Ledger entries for financial transactions
- Use Merchant for deduplication
- Log important actions to AuditLog
- Store transaction metadata in Transaction.meta
- Use AILearning for pattern recognition

### ❌ DON'T
- Trust Transaction balance alone
- Create duplicate merchants
- Forget AuditLog entries
- Skip Ledger entries
- Store PII in unnecessary fields

---

## Query Examples

### Get account balance
```js
db.ledger.find({ accountId: ObjectId(...) })
  .sort({ createdAt: -1 })
  .limit(1)
  .projection({ balanceAfter: 1 })
```

### Check budget status
```js
db.budget.findOne({
  userId: ObjectId(...),
  category: 'Food',
  startDate: { $lte: Date.now() },
  endDate: { $gte: Date.now() }
})
```

### Audit trail for transaction delete
```js
db.auditlog.find({
  action: 'DELETE_TRANSACTION',
  resourceId: ObjectId(...),
  userId: ObjectId(...)
})
```

### AI learning suggestions
```js
db.ailearning.find({
  userId: ObjectId(...),
  confidence: { $gte: 0.8 }
}).sort({ timesUsed: -1 })
```

---

## Indexes Summary

| Collection | Index | Purpose |
|------------|-------|---------|
| User | email (unique) | Login |
| Account | userId + provider + type (unique) | Prevent duplicates |
| Merchant | normalizedName (unique) | Deduplication |
| Ledger | userId + accountId + createdAt | Balance lookups |
| Ledger | accountId + createdAt | Fast reconciliation |
| AuditLog | userId + createdAt | Audit trail |
| AuditLog | action + createdAt | Action filtering |
| AILearning | userId + input (unique) | ML training |

---

**Last Updated:** 2026-04-25
