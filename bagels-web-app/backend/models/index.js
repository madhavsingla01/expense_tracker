// Database Models - Fintech Architecture
// This index exports all database models with proper relationships

module.exports = {
  User: require('./User'),
  Account: require('./Account'),
  Transaction: require('./Transaction'),
  Merchant: require('./Merchant'),
  Ledger: require('./Ledger'),
  AuditLog: require('./AuditLog'),
  Budget: require('./Budget'),
  AILearning: require('./AILearning'),
  ImportBatch: require('./ImportBatch'),
  Payment: require('./Payment'),
  PaymentAttempt: require('./PaymentAttempt'),

  // Legacy models (to be reviewed)
  LearningRule: require('./LearningRule'),
  Bill: require('./Bill'),
  Goal: require('./Goal'),
  Analytics: require('./Analytics'),
  Notification: require('./Notification'),
};

/**
 * SCHEMA RELATIONSHIPS:
 *
 * User (1) -> (Many) Account
 * User (1) -> (Many) Transaction
 * User (1) -> (Many) Ledger
 * User (1) -> (Many) Budget
 * User (1) -> (Many) AuditLog
 * User (1) -> (Many) AILearning
 *
 * Account (1) -> (Many) Transaction
 * Account (1) -> (Many) Ledger
 *
 * Transaction (1) -> (Many) Ledger
 * Merchant (1) -> (Many) Transaction
 *
 * KEY FEATURES:
 * - Ledger: Financial source of truth (never trust transaction alone)
 * - Merchant: Centralized merchant data for deduplication & AI categorization
 * - AuditLog: Compliance & security audit trail
 * - AILearning: ML training data for smart categorization
 * - Account: Multi-source payment management
 */
