/**
 * Intelligence Service — Core Brain
 * 
 * Every transaction flows through this pipeline:
 * Raw Input → Normalize → Detect Merchant → Predict Category → Learn → Save
 * 
 * 4-Tier Prediction Cascade:
 *   1. Merchant DB lookup     (confidence: 0.95)
 *   2. AI Learning history    (confidence: 0.7–0.9, weighted by timesUsed)
 *   3. LearningRule patterns  (confidence: 0.6)
 *   4. Heuristic keywords     (confidence: 0.4)
 *   5. Unknown fallback       (confidence: 0.3)
 */

const Merchant = require('../models/Merchant');
const AILearning = require('../models/AILearning');
const LearningRule = require('../models/LearningRule');

// Noise words to strip during normalization
const NOISE_WORDS = [
  'pvt', 'ltd', 'inc', 'llc', 'co', 'corp', 'corporation',
  'limited', 'private', 'india', 'international', 'intl',
  'online', 'digital', 'payment', 'payments', 'services',
  'solutions', 'technologies', 'tech', 'enterprises',
  'upi', 'imps', 'neft', 'rtgs', 'pos', 'atm', 'txn', 'txnid',
  'utr', 'rrn', 'ref', 'vpa', 'transfer', 'debit', 'credit',
  'card', 'bank', 'a/c', 'account',
  'www', 'com', 'in', 'org', 'net', 'io',
];

// Heuristic keyword → category mapping (tier 4 fallback)
const KEYWORD_MAP = [
  { pattern: /\b(uber eats|doordash|grubhub|zomato|swiggy|food ?panda|uber ?eats)\b/, category: 'Food & Delivery' },
  { pattern: /\b(starbucks|coffee|cafe|mcdonalds|burger|pizza|dominos|kfc|restaurant|dining|dine|biryani|chai|tea)\b/, category: 'Food & Dining' },
  { pattern: /\b(netflix|hulu|spotify|apple|prime|subscription|youtube|hotstar|disney|jio)\b/, category: 'Subscriptions' },
  { pattern: /\b(whole foods|kroger|safeway|trader|grocery|grocer|store|mart|bigbasket|blinkit|zepto|dmart|reliance)\b/, category: 'Groceries' },
  { pattern: /\b(uber|lyft|ola|taxi|cab|rapido|metro|bus|railway|irctc|redbus)\b/, category: 'Transport' },
  { pattern: /\b(delta|united|hotel|airbnb|booking|makemytrip|goibibo|flight|airline|travel|oyo|trivago)\b/, category: 'Travel' },
  { pattern: /\b(amazon|flipkart|myntra|ajio|target|walmart|bestbuy|shopping|steam|meesho|nykaa)\b/, category: 'Shopping' },
  { pattern: /\b(gas|shell|chevron|exxon|mobil|petrol|fuel|hp|bharat|iocl)\b/, category: 'Fuel' },
  { pattern: /\b(electric|water|internet|broadband|wifi|airtel|vodafone|jio|bsnl|bill|recharge)\b/, category: 'Utilities' },
  { pattern: /\b(hospital|doctor|pharma|medical|health|apollo|medplus|1mg|pharmacy|clinic)\b/, category: 'Healthcare' },
  { pattern: /\b(rent|emi|loan|mortgage|insurance|lic|policy)\b/, category: 'Bills & EMI' },
  { pattern: /\b(gym|fitness|yoga|sport|play|game)\b/, category: 'Health & Fitness' },
  { pattern: /\b(school|college|university|course|udemy|coursera|tuition|education|book)\b/, category: 'Education' },
  { pattern: /\b(salon|parlour|beauty|spa|haircut|grooming)\b/, category: 'Personal Care' },
  { pattern: /\b(donate|charity|ngo|temple|church|mosque|tithe)\b/, category: 'Donations' },
  { pattern: /\b(atm|withdraw|cash)\b/, category: 'Cash Withdrawal' },
  { pattern: /\b(transfer|sent|paid|upi)\b/, category: 'Transfer' },
];

class IntelligenceService {

  // ─── NORMALIZATION ──────────────────────────────────────────────

  /**
   * Normalize a raw merchant/payee name for deduplication and matching.
   * "DOMINOS PIZZA INDIA PVT LTD" → "dominos pizza"
   * "zomato.com online" → "zomato"
   */
  normalizeName(raw) {
    if (!raw) return '';

    let name = raw
      .toLowerCase()
      .trim()
      // Remove URLs
      .replace(/https?:\/\/\S+/g, '')
      // Remove UPI IDs but keep the readable handle part as a weak merchant signal
      .replace(/\b([a-z0-9._-]+)@[a-z0-9._-]+\b/g, '$1')
      // Remove domain extensions embedded in text
      .replace(/\.(com|in|org|net|io|co)\b/g, '')
      // Remove common bank statement reference runs
      .replace(/\b(?:utr|rrn|ref|txn|txnid)\s*[:/-]?\s*[a-z0-9]{5,}\b/g, ' ')
      // Remove special characters except spaces and alphanumeric
      .replace(/[^a-z0-9\s]/g, ' ')
      // Remove trailing order/reference numbers (e.g. "zomato 12345")
      .replace(/\b\d{4,}\b/g, '')
      // Remove noise words
      .replace(new RegExp(`\\b(${NOISE_WORDS.join('|')})\\b`, 'gi'), '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    return name;
  }

  // ─── 4-TIER PREDICTION CASCADE ──────────────────────────────────

  /**
   * Predict category for a given payee using 4-tier cascade.
   * Returns { category, confidence, source, merchantId? }
   */
  async predictCategory(userId, rawPayee) {
    if (!rawPayee) return { category: 'General', confidence: 0.3, source: 'unknown' };

    const normalized = this.normalizeName(rawPayee);
    if (!normalized) return { category: 'General', confidence: 0.3, source: 'unknown' };

    // ── TIER 1: Merchant DB (highest confidence) ──
    const merchant = await Merchant.findOne({
      $or: [
        { normalizedName: normalized },
        { alternateNames: normalized },
      ],
    }).lean();

    if (merchant && merchant.category) {
      return {
        category: merchant.category,
        confidence: Math.min(0.95, merchant.confidenceScore || 0.95),
        source: 'merchant_db',
        merchantId: merchant._id,
        merchantName: merchant.name,
      };
    }

    // ── TIER 2: AI Learning (user-specific learned patterns) ──
    const aiMatch = await AILearning.findOne({
      userId,
      input: normalized,
    }).lean();

    if (aiMatch && aiMatch.predictedCategory) {
      // Confidence scales with usage: base 0.7, max 0.9
      const usageBoost = Math.min(0.2, (aiMatch.timesUsed || 1) * 0.02);
      const confidence = Math.min(0.9, 0.7 + usageBoost);

      return {
        category: aiMatch.predictedCategory,
        confidence,
        source: 'ai_learning',
      };
    }

    // ── TIER 3: LearningRule patterns (regex-based) ──
    const ruleMatch = await LearningRule.findOne({
      userId,
      payeePattern: { $regex: new RegExp(normalized.split(' ')[0], 'i') },
    }).sort({ count: -1 }).lean();

    if (ruleMatch) {
      return {
        category: ruleMatch.category,
        confidence: 0.6,
        source: 'learning_rule',
      };
    }

    // ── TIER 4: Heuristic keyword matching ──
    const textToMatch = rawPayee.toLowerCase();
    for (const { pattern, category } of KEYWORD_MAP) {
      if (pattern.test(textToMatch) || pattern.test(normalized)) {
        return {
          category,
          confidence: 0.4,
          source: 'heuristic',
        };
      }
    }

    // ── TIER 5: Unknown ──
    return { category: 'General', confidence: 0.3, source: 'unknown' };
  }

  // ─── FULL PIPELINE ──────────────────────────────────────────────

  /**
   * Process a transaction through the full intelligence pipeline.
   * Called during transaction creation.
   * 
   * Returns { merchant, prediction, normalizedName }
   */
  async processTransaction(userId, rawPayee, userCategory) {
    const normalizedName = this.normalizeName(rawPayee);

    // Get prediction (even if user provided category, we still want to learn)
    const prediction = await this.predictCategory(userId, rawPayee);

    // Determine final category: user override > prediction
    const finalCategory = (userCategory && userCategory !== 'General')
      ? userCategory
      : prediction.category;

    // Find or create merchant
    let merchant = await Merchant.findOne({
      $or: [
        { normalizedName },
        { alternateNames: normalizedName },
      ],
    });

    if (merchant) {
      // Update usage stats
      merchant.usageCount = (merchant.usageCount || 0) + 1;
      merchant.lastUsedAt = new Date();

      // If user provided a specific category, update merchant confidence
      if (userCategory && userCategory !== 'General' && userCategory !== merchant.category) {
        merchant.category = userCategory;
        merchant.confidenceScore = Math.min(1, (merchant.confidenceScore || 0.8) + 0.05);
      }

      // Add raw name as alternate if different
      if (rawPayee.toLowerCase().trim() !== merchant.normalizedName) {
        const altNorm = rawPayee.toLowerCase().trim();
        if (!merchant.alternateNames.includes(altNorm)) {
          merchant.alternateNames.push(altNorm);
        }
      }

      await merchant.save();
    } else {
      // Create new merchant
      merchant = await Merchant.create({
        name: rawPayee,
        normalizedName,
        category: finalCategory,
        confidenceScore: userCategory ? 0.9 : prediction.confidence,
        usageCount: 1,
        lastUsedAt: new Date(),
        alternateNames: rawPayee.toLowerCase().trim() !== normalizedName
          ? [rawPayee.toLowerCase().trim()]
          : [],
      });
    }

    return {
      merchant,
      prediction: { ...prediction, category: finalCategory },
      normalizedName,
    };
  }

  // ─── LEARNING ───────────────────────────────────────────────────

  /**
   * Store/update learning data after a transaction is created.
   * Called as part of the pipeline.
   */
  async learn(userId, rawPayee, category, source = 'transaction') {
    const normalized = this.normalizeName(rawPayee);
    if (!normalized) return;

    // Update AILearning
    await AILearning.findOneAndUpdate(
      { userId, input: normalized },
      {
        $set: {
          predictedCategory: category,
          lastUsedAt: new Date(),
          correct: true,
        },
        $inc: { timesUsed: 1 },
        $setOnInsert: {
          confidence: 0.7,
        },
      },
      { upsert: true }
    );

    // Update LearningRule (payee → category pattern)
    await LearningRule.findOneAndUpdate(
      { userId, payeePattern: normalized },
      {
        $set: { category },
        $inc: { count: 1 },
      },
      { upsert: true }
    );
  }

  // ─── FEEDBACK LOOP ──────────────────────────────────────────────

  /**
   * Handle user correction: when user edits a transaction's category.
   * This is the KEY method that makes the system "smart".
   * 
   * Updates: Merchant DB, AILearning, LearningRule
   */
  async handleCorrection(userId, rawPayee, oldCategory, newCategory) {
    if (!rawPayee || oldCategory === newCategory) return;

    const normalized = this.normalizeName(rawPayee);

    // 1. Update Merchant DB
    const merchant = await Merchant.findOne({
      $or: [
        { normalizedName: normalized },
        { alternateNames: normalized },
      ],
    });

    if (merchant) {
      merchant.category = newCategory;
      merchant.confidenceScore = Math.min(1, (merchant.confidenceScore || 0.8) + 0.05);
      await merchant.save();
    }

    // 2. Update AI Learning — strong signal (user explicitly corrected)
    await AILearning.findOneAndUpdate(
      { userId, input: normalized },
      {
        $set: {
          predictedCategory: newCategory,
          confidence: 0.9,     // User correction = high confidence
          lastUsedAt: new Date(),
          correct: true,
        },
        $inc: { timesUsed: 1 },
      },
      { upsert: true }
    );

    // 3. Update LearningRule — increase count for new category
    await LearningRule.findOneAndUpdate(
      { userId, payeePattern: normalized },
      {
        $set: { category: newCategory },
        $inc: { count: 2 }, // Double weight for explicit correction
      },
      { upsert: true }
    );

    // 4. If old category had a different learning rule, decrease confidence
    const oldRule = await AILearning.findOne({
      userId,
      input: normalized,
      predictedCategory: oldCategory,
    });
    if (oldRule) {
      oldRule.correct = false;
      await oldRule.save();
    }
  }

  // ─── AUTO-SUGGEST ───────────────────────────────────────────────

  /**
   * Get full suggestions for a payee (used by /api/predict endpoint).
   * Returns category, confidence, merchant info, and alternative suggestions.
   */
  async getSuggestions(userId, rawPayee) {
    const prediction = await this.predictCategory(userId, rawPayee);
    const normalized = this.normalizeName(rawPayee);

    // Get alternative categories from AI learning history
    const alternatives = await AILearning.find({
      userId,
      input: { $regex: new RegExp(normalized.split(' ')[0], 'i') },
    })
      .sort({ timesUsed: -1 })
      .limit(3)
      .lean();

    const suggestions = alternatives
      .filter(a => a.predictedCategory !== prediction.category)
      .map(a => ({
        category: a.predictedCategory,
        confidence: Math.min(0.9, 0.5 + (a.timesUsed || 1) * 0.02),
        timesUsed: a.timesUsed,
      }));

    // Get merchant info if available
    const merchant = await Merchant.findOne({
      $or: [
        { normalizedName: normalized },
        { alternateNames: normalized },
      ],
    }).lean();

    return {
      category: prediction.category,
      confidence: prediction.confidence,
      source: prediction.source,
      merchant: merchant ? {
        name: merchant.name,
        normalizedName: merchant.normalizedName,
        usageCount: merchant.usageCount || 0,
      } : null,
      suggestions,
    };
  }
}

module.exports = new IntelligenceService();
