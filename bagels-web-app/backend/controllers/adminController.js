const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Merchant = require('../models/Merchant');
const AILearning = require('../models/AILearning');
const LearningRule = require('../models/LearningRule');
const Bill = require('../models/Bill');
const AuditLog = require('../models/AuditLog');
const ImportBatch = require('../models/ImportBatch');
const Feedback = require('../models/Feedback');

const VISIBLE_TRANSACTION_STATUSES = ['success', 'unverified'];

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number.parseFloat(value.toString());
}

function formatCurrency(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseDayBounds(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function buildTransactionFilters(query) {
  const filters = {};
  const createdAt = {};
  const start = parseDayBounds(query.start);
  const end = parseDayBounds(query.end, true);

  if (start) createdAt.$gte = start;
  if (end) createdAt.$lte = end;
  if (Object.keys(createdAt).length > 0) {
    filters.date = createdAt;
  }

  return filters;
}

function renderAdmin(res, view, extras = {}) {
  res.render(`admin/${view}`, {
    activeNav: view,
    helpers: {
      toNumber,
      formatCurrency,
      formatDateTime,
    },
    ...extras,
  });
}

async function findMatchingUserIds(userQuery) {
  if (!userQuery) return [];

  const regex = new RegExp(userQuery.trim(), 'i');
  const users = await User.find({
    $or: [
      { email: regex },
      { phoneNumber: regex },
      { 'profile.firstName': regex },
      { 'profile.lastName': regex },
    ],
  }).select('_id');

  return users.map((user) => user._id);
}

async function getDashboard(req, res) {
  const todayStart = parseDayBounds(new Date());
  const todayEnd = parseDayBounds(new Date(), true);

  const [userCount, transactionCount, pendingFeedbackCount, totalVolumeResult, todayTransactions, recentLogs] = await Promise.all([
    User.countDocuments(),
    Transaction.countDocuments({ status: { $in: VISIBLE_TRANSACTION_STATUSES } }),
    Feedback.countDocuments({ status: 'pending' }),
    Transaction.aggregate([
      { $match: { status: { $in: VISIBLE_TRANSACTION_STATUSES } } },
      { $group: { _id: null, totalVolume: { $sum: { $toDouble: '$amount' } } } },
    ]),
    Transaction.find({
      status: { $in: VISIBLE_TRANSACTION_STATUSES },
      date: { $gte: todayStart, $lte: todayEnd },
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(10)
      .populate('userId', 'email phoneNumber profile.firstName profile.lastName')
      .lean(),
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('userId', 'email')
      .lean(),
  ]);

  const todayActivity = todayTransactions.reduce((summary, transaction) => {
    summary.count += 1;
    summary.volume += toNumber(transaction.amount);
    return summary;
  }, { count: 0, volume: 0 });

  renderAdmin(res, 'dashboard', {
    pageTitle: 'Admin Dashboard',
    stats: {
      userCount,
      transactionCount,
      totalVolume: totalVolumeResult[0]?.totalVolume || 0,
      todayCount: todayActivity.count,
      todayVolume: todayActivity.volume,
      pendingFeedbackCount,
    },
    todayTransactions,
    recentLogs,
  });
}

async function listUsers(req, res) {
  const q = String(req.query.q || '').trim();
  const search = q ? {
    $or: [
      { email: new RegExp(q, 'i') },
      { phoneNumber: new RegExp(q, 'i') },
      { 'profile.firstName': new RegExp(q, 'i') },
      { 'profile.lastName': new RegExp(q, 'i') },
    ],
  } : {};

  const users = await User.find(search)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const userIds = users.map((user) => user._id);
  const transactionCounts = userIds.length > 0
    ? await Transaction.aggregate([
        { $match: { userId: { $in: userIds }, status: { $in: VISIBLE_TRANSACTION_STATUSES } } },
        { $group: { _id: '$userId', count: { $sum: 1 }, volume: { $sum: { $toDouble: '$amount' } } } },
      ])
    : [];

  const countMap = new Map(transactionCounts.map((item) => [String(item._id), item]));

  renderAdmin(res, 'users', {
    pageTitle: 'Users',
    filters: { q },
    users: users.map((user) => ({
      ...user,
      transactionCount: countMap.get(String(user._id))?.count || 0,
      transactionVolume: countMap.get(String(user._id))?.volume || 0,
    })),
  });
}

async function getUserDetails(req, res) {
  const user = await User.findById(req.params.userId).lean();
  if (!user) {
    return res.status(404).render('admin/not-found', {
      activeNav: 'users',
      pageTitle: 'User Not Found',
    });
  }

  const [transactions, auditLogs] = await Promise.all([
    Transaction.find({ userId: user._id, status: { $in: VISIBLE_TRANSACTION_STATUSES } })
      .sort({ date: -1, createdAt: -1 })
      .limit(50)
      .populate('merchantId', 'name normalizedName category')
      .lean(),
    AuditLog.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  renderAdmin(res, 'user-details', {
    activeNav: 'users',
    pageTitle: 'User Details',
    user,
    transactions,
    auditLogs,
  });
}

async function listTransactions(req, res) {
  const q = String(req.query.q || '').trim();
  const userQuery = String(req.query.user || '').trim();
  const filters = buildTransactionFilters(req.query);
  filters.status = { $in: VISIBLE_TRANSACTION_STATUSES };

  if (q) {
    filters.$or = [
      { vendorName: new RegExp(q, 'i') },
      { category: new RegExp(q, 'i') },
      { 'meta.note': new RegExp(q, 'i') },
      { 'meta.txnId': new RegExp(q, 'i') },
    ];
  }

  if (userQuery) {
    const matchingIds = await findMatchingUserIds(userQuery);
    filters.userId = matchingIds.length > 0 ? { $in: matchingIds } : null;
  }

  if (filters.userId === null) {
    return renderAdmin(res, 'transactions', {
      pageTitle: 'Transactions',
      filters: {
        q,
        user: userQuery,
        start: req.query.start || '',
        end: req.query.end || '',
      },
      transactions: [],
    });
  }

  const transactions = await Transaction.find(filters)
    .sort({ date: -1, createdAt: -1 })
    .limit(200)
    .populate('userId', 'email phoneNumber')
    .populate('merchantId', 'name normalizedName category')
    .lean();

  renderAdmin(res, 'transactions', {
    pageTitle: 'Transactions',
    filters: {
      q,
      user: userQuery,
      start: req.query.start || '',
      end: req.query.end || '',
    },
    transactions,
  });
}

async function listMerchants(req, res) {
  const q = String(req.query.q || '').trim();
  const search = q ? {
    $or: [
      { name: new RegExp(q, 'i') },
      { normalizedName: new RegExp(q, 'i') },
      { category: new RegExp(q, 'i') },
    ],
  } : {};

  const merchants = await Merchant.find(search)
    .sort({ usageCount: -1, updatedAt: -1 })
    .limit(150)
    .lean();

  renderAdmin(res, 'merchants', {
    pageTitle: 'Merchants',
    filters: { q },
    merchants,
  });
}

async function updateMerchant(req, res) {
  const update = {};
  if (req.body.category) update.category = req.body.category.trim();
  if (req.body.name) update.name = req.body.name.trim();
  if (req.body.normalizedName) update.normalizedName = req.body.normalizedName.trim().toLowerCase();

  const merchant = await Merchant.findByIdAndUpdate(req.params.merchantId, update, { runValidators: true, new: true });

  // Propagate category change to intelligence system so predictions stay consistent
  if (update.category && merchant) {
    const normalizedName = merchant.normalizedName;

    await Promise.all([
      AILearning.updateMany(
        { input: normalizedName },
        { $set: { predictedCategory: update.category, correct: true } }
      ),
      LearningRule.updateMany(
        { payeePattern: normalizedName },
        { $set: { category: update.category } }
      ),
    ]);
  }

  res.redirect('/admin/merchants');
}

async function listAi(req, res) {
  const q = String(req.query.q || '').trim();
  const userIds = q ? await findMatchingUserIds(q) : [];

  const learningFilters = {};
  const ruleFilters = {};

  if (q) {
    learningFilters.$or = [
      { input: new RegExp(q, 'i') },
      { predictedCategory: new RegExp(q, 'i') },
      ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
    ];

    ruleFilters.$or = [
      { payeePattern: new RegExp(q, 'i') },
      { category: new RegExp(q, 'i') },
      ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
    ];
  }

  const [patterns, rules] = await Promise.all([
    AILearning.find(learningFilters)
      .sort({ lastUsedAt: -1, timesUsed: -1 })
      .limit(120)
      .populate('userId', 'email')
      .lean(),
    LearningRule.find(ruleFilters)
      .sort({ count: -1, updatedAt: -1 })
      .limit(120)
      .populate('userId', 'email')
      .lean(),
  ]);

  renderAdmin(res, 'ai', {
    pageTitle: 'AI Control',
    filters: { q },
    patterns,
    rules,
  });
}

async function listOcr(req, res) {
  const q = String(req.query.q || '').trim();
  const transactionFilters = {
    $or: [
      { source: 'ocr' },
      { receiptUrl: { $ne: '' } },
    ],
  };

  if (q) {
    transactionFilters.$and = [{
      $or: [
        { vendorName: new RegExp(q, 'i') },
        { category: new RegExp(q, 'i') },
        { 'meta.note': new RegExp(q, 'i') },
      ],
    }];
  }

  const [transactions, bills] = await Promise.all([
    Transaction.find(transactionFilters)
      .sort({ createdAt: -1 })
      .limit(120)
      .populate('userId', 'email')
      .lean(),
    Bill.find(q ? {
      $or: [
        { vendorName: new RegExp(q, 'i') },
        { billType: new RegExp(q, 'i') },
      ],
    } : {})
      .sort({ createdAt: -1 })
      .limit(80)
      .populate('userId', 'email')
      .lean(),
  ]);

  renderAdmin(res, 'ocr', {
    pageTitle: 'OCR Monitor',
    filters: { q },
    transactions,
    bills,
  });
}

async function listImports(req, res) {
  const q = String(req.query.q || '').trim();
  const filters = q ? {
    $or: [
      { fileName: new RegExp(q, 'i') },
      { parser: new RegExp(q, 'i') },
      { status: new RegExp(q, 'i') },
    ],
  } : {};

  const imports = await ImportBatch.find(filters)
    .sort({ createdAt: -1 })
    .limit(120)
    .populate('userId', 'email phoneNumber')
    .lean();

  renderAdmin(res, 'imports', {
    pageTitle: 'Statement Imports',
    filters: { q },
    imports,
  });
}

async function listLogs(req, res) {
  const status = String(req.query.status || '').trim();
  const filters = {};

  if (status === 'failure' || status === 'success') {
    filters.status = status;
  }

  const logs = await AuditLog.find(filters)
    .sort({ createdAt: -1 })
    .limit(150)
    .populate('userId', 'email')
    .lean();

  renderAdmin(res, 'logs', {
    pageTitle: 'Recent Logs',
    filters: { status },
    logs,
  });
}

async function listFeedback(req, res) {
  const status = String(req.query.status || '').trim();
  const category = String(req.query.category || '').trim();
  const q = String(req.query.q || '').trim();
  const sort = String(req.query.sort || 'newest').trim();
  const filters = {};

  if (status === 'pending' || status === 'reviewed') {
    filters.status = status;
  }

  if (['general', 'bug', 'feature', 'payment', 'import', 'mobile', 'account', 'other'].includes(category)) {
    filters.category = category;
  }

  if (q) {
    const matchingUserIds = await findMatchingUserIds(q);
    filters.$or = [
      { message: new RegExp(q, 'i') },
      { category: new RegExp(q, 'i') },
      ...(matchingUserIds.length > 0 ? [{ user: { $in: matchingUserIds } }] : []),
    ];
  }

  const feedbacks = await Feedback.find(filters)
    .sort({ createdAt: sort === 'oldest' ? 1 : -1 })
    .limit(250)
    .populate('user', 'email phoneNumber profile.firstName profile.lastName profile.avatar')
    .lean();

  const statusCounts = await Feedback.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  renderAdmin(res, 'feedback', {
    pageTitle: 'User Feedback',
    filters: { status, category, q, sort },
    feedbacks,
    statusCounts: Object.fromEntries(statusCounts.map((item) => [item._id, item.count])),
  });
}

async function reviewFeedback(req, res) {
  await Feedback.findByIdAndUpdate(req.params.id, { status: 'reviewed', reviewedAt: new Date() });
  res.redirect(req.get('referer') || '/admin/feedback');
}

module.exports = {
  getDashboard,
  listUsers,
  getUserDetails,
  listTransactions,
  listMerchants,
  updateMerchant,
  listAi,
  listOcr,
  listImports,
  listLogs,
  listFeedback,
  reviewFeedback,
};
