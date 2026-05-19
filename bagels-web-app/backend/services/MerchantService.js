/**
 * Merchant Service
 * Handles merchant CRUD and delegates intelligence to IntelligenceService
 */

const Merchant = require('../models/Merchant');
const Transaction = require('../models/Transaction');
const IntelligenceService = require('./IntelligenceService');
const { validateRequiredField } = require('./ValidationService');

class MerchantService {
  /**
   * Normalize merchant name — delegates to IntelligenceService
   */
  normalizeMerchantName(merchantName) {
    return IntelligenceService.normalizeName(merchantName);
  }

  /**
   * Find or create merchant via intelligence pipeline
   */
  async findOrCreateMerchant(merchantName, category, confidenceScore = 0.8) {
    validateRequiredField(merchantName, 'Merchant name');

    const normalizedName = this.normalizeMerchantName(merchantName);

    // Check if merchant already exists
    let merchant = await Merchant.findOne({
      $or: [
        { normalizedName },
        { alternateNames: normalizedName },
      ],
    });

    if (merchant) {
      // Update usage
      merchant.usageCount = (merchant.usageCount || 0) + 1;
      merchant.lastUsedAt = new Date();

      // Update confidence if new one is higher
      if (confidenceScore > merchant.confidenceScore) {
        merchant.confidenceScore = confidenceScore;
      }
      await merchant.save();
      return merchant;
    }

    // Create new merchant
    merchant = await Merchant.create({
      name: merchantName,
      normalizedName,
      category: category || 'General',
      confidenceScore,
      usageCount: 1,
      lastUsedAt: new Date(),
    });

    return merchant;
  }

  /**
   * Update merchant with alternate name for better deduplication
   */
  async addAlternateNames(merchantId, alternateNames) {
    if (!Array.isArray(alternateNames) || alternateNames.length === 0) {
      return;
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return;

    const normalized = alternateNames.map((name) => this.normalizeMerchantName(name));
    merchant.alternateNames = [...new Set([...merchant.alternateNames, ...normalized])];
    await merchant.save();
  }

  /**
   * Search merchant by name (for autocomplete, suggestions)
   */
  async searchMerchants(searchTerm, limit = 10) {
    const normalized = this.normalizeMerchantName(searchTerm);

    const merchants = await Merchant.find({
      $or: [
        { normalizedName: { $regex: normalized, $options: 'i' } },
        { alternateNames: { $regex: normalized, $options: 'i' } },
      ],
    })
      .sort({ usageCount: -1 })
      .limit(limit)
      .lean();

    return merchants;
  }

  async getSmartSuggestions(userId, searchTerm = '', limit = 8) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 20)
      : 8;
    const normalized = this.normalizeMerchantName(searchTerm);
    const merchantQuery = normalized
      ? {
          $or: [
            { normalizedName: { $regex: normalized, $options: 'i' } },
            { alternateNames: { $regex: normalized, $options: 'i' } },
            { name: { $regex: searchTerm, $options: 'i' } },
          ],
        }
      : {};

    const [merchants, recentTransactions] = await Promise.all([
      Merchant.find(merchantQuery)
        .sort({ usageCount: -1, lastUsedAt: -1 })
        .limit(safeLimit)
        .lean(),
      Transaction.find({
        userId,
        status: { $in: ['success', 'unverified'] },
        ...(searchTerm ? { vendorName: { $regex: searchTerm, $options: 'i' } } : {}),
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(safeLimit)
        .lean(),
    ]);

    const merged = new Map();

    recentTransactions.forEach((transaction) => {
      const merchantName = transaction.vendorName || '';
      const key = this.normalizeMerchantName(merchantName);
      if (!key) return;
      merged.set(key, {
        name: merchantName,
        normalizedName: key,
        category: transaction.category || 'General',
        confidenceScore: transaction.meta?.confidence || 0.7,
        source: 'recent_transaction',
      });
    });

    merchants.forEach((merchant) => {
      merged.set(merchant.normalizedName, {
        name: merchant.name,
        normalizedName: merchant.normalizedName,
        category: merchant.category,
        confidenceScore: merchant.confidenceScore || 0.8,
        usageCount: merchant.usageCount || 0,
        source: 'merchant_db',
      });
    });

    return Array.from(merged.values()).slice(0, safeLimit);
  }

  /**
   * Get merchant by normalized name
   */
  async getMerchantByNormalizedName(normalizedName) {
    return await Merchant.findOne({ normalizedName }).lean();
  }

  /**
   * Get merchants by category
   */
  async getMerchantsByCategory(category, limit = 20) {
    return await Merchant.find({ category }).limit(limit).lean();
  }

  /**
   * Predict category — delegates to IntelligenceService (4-tier cascade)
   */
  async predictCategory(userId, payee) {
    const result = await IntelligenceService.predictCategory(userId, payee);
    return result.category;
  }

  /**
   * Get full prediction with confidence
   */
  async predictCategoryFull(userId, payee) {
    return await IntelligenceService.getSuggestions(userId, payee);
  }

  /**
   * Update merchant category (used by feedback loop)
   */
  async updateMerchantCategory(normalizedName, newCategory) {
    const merchant = await Merchant.findOne({ normalizedName });
    if (merchant) {
      merchant.category = newCategory;
      merchant.confidenceScore = Math.min(1, (merchant.confidenceScore || 0.8) + 0.05);
      await merchant.save();
    }
  }
}

module.exports = new MerchantService();
