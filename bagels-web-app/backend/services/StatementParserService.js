const path = require('path');
const xlsx = require('xlsx');
const { ValidationError } = require('./ValidationService');

const DATE_PATTERNS = [
  /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
  /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
  /\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{2,4})\b/i,
  /\b(\d{1,2})-([a-z]{3})-(\d{2,4})\b/i,
];

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const HEADER_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'posting date', 'value date', 'booking date'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction details'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'dr', 'paid out'],
  credit: ['credit', 'deposit', 'deposits', 'cr', 'paid in'],
  amount: ['amount', 'transaction amount', 'txn amount'],
  type: ['type', 'dr cr', 'debit credit', 'transaction type', 'cr dr'],
  balance: ['balance', 'closing balance', 'available balance'],
};

const DESCRIPTION_NOISE = [
  /\b(upi|imps|neft|rtgs|pos|atm|ach|ecs|nach|debit card|credit card|card payment)\b/gi,
  /\b(txn|txnid|ref|rrn|utr|vpa|ifsc|a\/c|account|transfer|payment|paid|sent|received)\b/gi,
  /\b(?:\d{6,}|[a-z]{2,}\d{4,}|\d{3,}[a-z]{2,})\b/gi,
  /[|*_#:@]/g,
];

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHeaderIndex(headers, type) {
  const aliases = HEADER_ALIASES[type] || [];
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function parseYear(value) {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return null;
  return year < 100 ? 2000 + year : year;
}

function toDate(year, month, day) {
  const fullYear = parseYear(year);
  const monthNum = Number.parseInt(month, 10);
  const dayNum = Number.parseInt(day, 10);
  if (!fullYear || !monthNum || !dayNum) return null;

  const date = new Date(fullYear, monthNum - 1, dayNum);
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== monthNum - 1 ||
    date.getDate() !== dayNum
  ) {
    return null;
  }

  return date;
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const iso = text.match(DATE_PATTERNS[0]);
  if (iso) return toDate(iso[1], iso[2], iso[3]);

  const numeric = text.match(DATE_PATTERNS[1]);
  if (numeric) {
    const first = Number.parseInt(numeric[1], 10);
    const second = Number.parseInt(numeric[2], 10);
    const day = second > 12 ? numeric[2] : numeric[1];
    const month = second > 12 ? numeric[1] : numeric[2];
    return toDate(numeric[3], month, day);
  }

  const named = text.match(DATE_PATTERNS[2]) || text.match(DATE_PATTERNS[3]);
  if (named) {
    const month = MONTHS[String(named[2]).slice(0, 4).toLowerCase()]
      || MONTHS[String(named[2]).slice(0, 3).toLowerCase()];
    if (!month) return null;
    return toDate(named[3], String(month), named[1]);
  }

  return null;
}

function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\(([^)]+)\)/g, '-$1')
    .replace(/,/g, '')
    .replace(/[^\d.+-]/g, '')
    .trim();
  if (!text || text === '-' || text === '+') return null;

  const amount = Number.parseFloat(text);
  return Number.isFinite(amount) ? amount : null;
}

function extractMoneyCandidates(line) {
  const matches = [];
  const moneyPattern = /(?:^|[^\d])([+-]?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|[+-]?\d+\.\d{1,2})(?:\s*(cr|dr))?/gi;
  let match;

  while ((match = moneyPattern.exec(line)) !== null) {
    const amount = parseAmount(match[1]);
    if (!amount || Math.abs(amount) < 0.01) continue;
    matches.push({
      amount,
      marker: match[2] ? match[2].toLowerCase() : '',
      index: match.index,
    });
  }

  return matches;
}

function cleanDescription(value) {
  let text = String(value || '').trim();
  DESCRIPTION_NOISE.forEach((pattern) => {
    text = text.replace(pattern, ' ');
  });

  return text
    .replace(/\s+/g, ' ')
    .replace(/^\W+|\W+$/g, '')
    .trim();
}

function deriveMerchant(description) {
  const cleaned = cleanDescription(description);
  if (!cleaned) return String(description || 'Unknown Merchant').trim() || 'Unknown Merchant';

  const upiMatch = cleaned.match(/\b([a-z0-9._-]+@[a-z0-9._-]+)\b/i);
  if (upiMatch) return upiMatch[1];

  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(' ') || cleaned;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((entry) => entry !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((entry) => entry !== '')) rows.push(row);

  return rows;
}

function getColumnValue(row, indexOrArray) {
  if (indexOrArray === undefined || indexOrArray === null || indexOrArray === -1) return null;
  if (Array.isArray(indexOrArray)) {
    return indexOrArray.map(idx => row[idx]).filter(Boolean).join(' ');
  }
  return row[indexOrArray] || null;
}

function mapCsvRow(row, indexes, rowNumber) {
  const dateStr = getColumnValue(row, indexes.date);
  const date = dateStr ? parseDate(dateStr) : null;
  const rawDescription = getColumnValue(row, indexes.description) || row.join(' ');
  
  const debitStr = getColumnValue(row, indexes.debit);
  const creditStr = getColumnValue(row, indexes.credit);
  const amountStr = getColumnValue(row, indexes.amount);
  const typeStr = getColumnValue(row, indexes.type);
  
  const debit = debitStr ? parseAmount(debitStr) : null;
  const credit = creditStr ? parseAmount(creditStr) : null;
  const amountValue = amountStr ? parseAmount(amountStr) : null;

  let amount = null;
  let type = 'expense';

  if (debit && debit > 0) {
    amount = debit;
    type = 'expense';
  } else if (credit && credit > 0) {
    amount = credit;
    type = 'income';
  } else if (amountValue !== null) {
    amount = Math.abs(amountValue);
    if (typeStr) {
      type = inferType(typeStr);
    } else {
      type = amountValue < 0 ? 'expense' : inferType(rawDescription);
    }
  }

  if (!date || !amount || !rawDescription) return null;

  return {
    rowNumber,
    date,
    amount,
    type,
    description: rawDescription,
    merchant: deriveMerchant(rawDescription),
    raw: row,
  };
}

function inferType(text, explicitMarker = '') {
  const value = `${text || ''} ${explicitMarker || ''}`.toLowerCase();
  if (/\b(cr|credit|deposit|refund|salary|received)\b/.test(value)) return 'income';
  return 'expense';
}

function parseTextLine(line, rowNumber) {
  const dateMatch = DATE_PATTERNS
    .map((pattern) => line.match(pattern))
    .find(Boolean);
  if (!dateMatch) return null;

  const date = parseDate(dateMatch[0]);
  if (!date) return null;

  const amounts = extractMoneyCandidates(line);
  if (amounts.length === 0) return null;

  const amountCandidate = amounts.length >= 3 ? amounts[amounts.length - 2] : amounts[amounts.length - 1];
  const amount = Math.abs(amountCandidate.amount);
  if (!amount) return null;

  const descriptionStart = dateMatch.index + dateMatch[0].length;
  const descriptionEnd = amountCandidate.index > descriptionStart ? amountCandidate.index : line.length;
  const rawDescription = line.slice(descriptionStart, descriptionEnd).trim() || line;

  return {
    rowNumber,
    date,
    amount,
    type: amountCandidate.amount < 0 ? 'expense' : inferType(line, amountCandidate.marker),
    description: rawDescription,
    merchant: deriveMerchant(rawDescription),
    raw: line,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LEGACY LINE-BY-LINE PARSER (preserved as safe fallback)
// ═══════════════════════════════════════════════════════════════════════════════

function parseTextStatementLegacy(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line, index) => parseTextLine(line, index + 1))
    .filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ADVANCED BLOCK-BASED TRANSACTION RECONSTRUCTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Lines that should never be treated as transactions
const NON_TRANSACTION_PATTERNS = [
  /^\s*page\s+\d/i,
  /^\s*statement\s+(of|period|from|for)/i,
  /^\s*(opening|closing)\s+balance/i,
  /^\s*balance\s+(brought|carried)\s+(forward|fwd)/i,
  /^\s*(total|grand\s+total|sub\s*total)/i,
  /^\s*reward\s*point/i,
  /^\s*(branch|ifsc|micr|cin|address|customer|a\/c\s*no|account\s*number)/i,
  /^\s*(generated|printed|downloaded)\s+(on|at|by)/i,
  /^\s*this\s+is\s+(a\s+)?computer/i,
  /^\s*\*{3,}/,
  /^\s*-{5,}/,
  /^\s*={5,}/,
  /^\s*(note|disclaimer|important|insurance|nominee)/i,
  /^\s*(sr\.?\s*no|s\.?\s*no|sl\.?\s*no)\b/i,
  /^\s*date\s+(of\s+)?transaction/i,
  /^\s*particulars\s+/i,
  /^\s*(debit|credit|withdrawal|deposit)\s+(amount)?$/i,
];

function isNonTransactionLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return true;
  return NON_TRANSACTION_PATTERNS.some(p => p.test(trimmed));
}

// Check if a line starts with a date (transaction start marker)
function lineStartsWithDate(line) {
  const trimmed = line.trim();
  // Must start near the beginning with a date pattern
  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match.index < 5) return true;
  }
  return false;
}

// ── SMART MERCHANT EXTRACTION ──────────────────────────────────────────────

const UPI_MERCHANT_PATTERNS = [
  // UPI/REF/MERCHANT_NAME/VPA@bank — extract MERCHANT_NAME
  /UPI\/\d+\/([^/]+)\/[^/]*@[a-z]+/i,
  // UPI/REF/MERCHANT/... — extract after second slash
  /UPI\/\d+\/([^/]{3,})/i,
  // Standalone VPA: name@bank — use the name part
  /\b([a-z0-9._-]{3,})@[a-z]{2,}\b/i,
];

const PAYMENT_MODE_PATTERNS = [
  { pattern: /\bUPI\b/i, mode: 'UPI' },
  { pattern: /\bIMPS\b/i, mode: 'IMPS' },
  { pattern: /\bNEFT\b/i, mode: 'NEFT' },
  { pattern: /\bRTGS\b/i, mode: 'RTGS' },
  { pattern: /\bATM\s*(WITHDRAWAL|WDL|SELF)/i, mode: 'ATM' },
  { pattern: /\bPURCHASE\b/i, mode: 'POS' },
  { pattern: /\bPOS\b/i, mode: 'POS' },
  { pattern: /\bCASH\s*(DEP|DEPOSIT)/i, mode: 'Cash Deposit' },
  { pattern: /\bCHEQUE\b/i, mode: 'Cheque' },
  { pattern: /\bACH\b|\bNACH\b|\bECS\b/i, mode: 'Auto-Debit' },
  { pattern: /\bINTEREST\s*(CREDIT|PAID)/i, mode: 'Interest' },
];

const CATEGORY_KEYWORDS = [
  { pattern: /\b(ixigo|makemytrip|goibibo|cleartrip|yatra|redbus|irctc|travenues)\b/i, category: 'Travel' },
  { pattern: /\b(airtel|vodafone|jio|bsnl|recharge|tata\s*sky|d2h)\b/i, category: 'Recharge' },
  { pattern: /\b(amazon|flipkart|myntra|ajio|meesho|nykaa|snapdeal)\b/i, category: 'Shopping' },
  { pattern: /\b(zomato|swiggy|dunzo|blinkit|zepto|bigbasket|grofers)\b/i, category: 'Food & Delivery' },
  { pattern: /\b(uber|ola|rapido|metro|parking|toll|fastag)\b/i, category: 'Transport' },
  { pattern: /\b(netflix|hotstar|spotify|youtube|prime|disney|subscription)\b/i, category: 'Subscriptions' },
  { pattern: /\b(hotel|lodge|oyo|trivago|airbnb|resort)\b/i, category: 'Travel' },
  { pattern: /\b(hospital|clinic|doctor|pharma|medplus|1mg|apollo|medical)\b/i, category: 'Healthcare' },
  { pattern: /\b(lic|insurance|premium|policy|icici\s*pru|hdfc\s*life)\b/i, category: 'Insurance' },
  { pattern: /\b(emi|loan|mortgage|bajaj\s*fin|hdfc\s*ltd)\b/i, category: 'EMI & Loans' },
  { pattern: /\b(petrol|diesel|fuel|hp\s*pay|bharat\s*petroleum|iocl|shell)\b/i, category: 'Fuel' },
  { pattern: /\b(electric|water|gas\s*bill|broadband|wifi|internet|utility)\b/i, category: 'Utilities' },
  { pattern: /\b(rent|landlord|house\s*rent)\b/i, category: 'Rent' },
  { pattern: /\b(school|college|university|tuition|education|course|udemy|coursera)\b/i, category: 'Education' },
  { pattern: /\b(salon|parlour|beauty|spa|grooming)\b/i, category: 'Personal Care' },
  { pattern: /\b(gym|fitness|yoga|sport|cult\.?fit)\b/i, category: 'Health & Fitness' },
  { pattern: /\b(atm|withdrawal|self.?switch|cash\s*wdl)\b/i, category: 'Cash Withdrawal' },
  { pattern: /\b(salary|payroll|stipend)\b/i, category: 'Salary' },
  { pattern: /\b(interest\s*credit|int\.?\s*credit)\b/i, category: 'Interest' },
  { pattern: /\b(refund|reversal|cashback)\b/i, category: 'Refund' },
  { pattern: /\b(gpay|google\s*pay|phonepe|paytm|cred)\b/i, category: 'Transfer' },
  { pattern: /\b(restaurant|cafe|coffee|starbucks|dominos|pizza|mcdonalds|kfc|biryani|dining)\b/i, category: 'Food & Dining' },
];

function extractSmartMerchant(description) {
  if (!description) return 'Unknown Merchant';
  const text = description.replace(/\s+/g, ' ').trim();

  // Try UPI-specific patterns first
  for (const { pattern } of UPI_MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let merchant = match[1].trim();
      // Clean up: remove trailing reference numbers, slashes
      merchant = merchant
        .replace(/\/+$/, '')
        .replace(/\b\d{6,}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (merchant.length >= 3) return merchant;
    }
  }

  // Try extracting from NEFT/IMPS patterns: NEFT BANK_NAME ...
  const neftMatch = text.match(/(?:NEFT|IMPS|RTGS)\s+(.+?)(?:\s+\d{6,}|\s*$)/i);
  if (neftMatch && neftMatch[1]) {
    const merchant = neftMatch[1].replace(/\b\d{6,}\b/g, '').trim();
    if (merchant.length >= 3) return merchant;
  }

  // Try extracting from PURCHASE patterns: PURCHASE MERCHANT_NAME CITY
  // ATM transactions don't have a real merchant — return clean label
  const atmMatch = text.match(/ATM\s*(WITHDRAWAL|WDL|SELF)/i);
  if (atmMatch) return 'ATM Cash Withdrawal';

  const purchaseMatch = text.match(/PURCHASE\s+(.+?)(?:\s+IN\s+\d|$)/i);
  if (purchaseMatch && purchaseMatch[1]) {
    return purchaseMatch[1].replace(/\b\d{6,}\b/g, '').trim();
  }

  // Fall back to generic cleaning
  return deriveMerchant(text);
}

function detectPaymentMode(description) {
  for (const { pattern, mode } of PAYMENT_MODE_PATTERNS) {
    if (pattern.test(description)) return mode;
  }
  return 'Other';
}

function autoCategorizeFromDescription(description) {
  if (!description) return { category: 'General', confidence: 0.3 };
  const text = description.toLowerCase();
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return { category, confidence: 0.5 };
  }
  return { category: 'General', confidence: 0.3 };
}

// Extract a reference number from the description block
function extractReference(description) {
  // UPI reference
  const upiRef = description.match(/UPI\/(\d{9,})/i);
  if (upiRef) return upiRef[1];
  // UTR/RRN
  const utrMatch = description.match(/(?:UTR|RRN|REF)\s*[:/-]?\s*([A-Z0-9]{8,})/i);
  if (utrMatch) return utrMatch[1];
  return null;
}

/**
 * Block-based transaction reconstruction engine.
 * 
 * Algorithm:
 * 1. Split PDF text into lines
 * 2. Scan for lines starting with dates (= transaction start markers)
 * 3. Group consecutive non-date lines as continuation of the current block
 * 4. For each block: merge lines → extract amounts → classify → produce entry
 */
function parseTextStatementAdvanced(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/\t/g, '  ').trimEnd());

  // Phase 1: Build transaction blocks
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (isNonTransactionLine(line)) continue;

    if (lineStartsWithDate(line)) {
      // Flush previous block
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { lines: [line], startLine: i + 1 };
    } else if (currentBlock) {
      // Continuation line — append to current block
      currentBlock.lines.push(line);
    }
    // If no current block and line doesn't start with date, skip it
    // (this handles pre-transaction header/noise)
  }
  // Flush last block
  if (currentBlock) blocks.push(currentBlock);

  // Phase 2: Parse each block into a transaction
  const entries = [];

  for (const block of blocks) {
    const merged = block.lines.join(' ').replace(/\s+/g, ' ').trim();
    
    // Extract date from the start of the merged block
    const date = parseDate(merged);
    if (!date) continue;

    // Extract all money candidates from the merged block
    const amounts = extractMoneyCandidates(merged);
    if (amounts.length === 0) continue;

    // Heuristic for Indian bank statements:
    // - If 2+ amounts: last = balance, second-to-last = transaction amount
    // - If 1 amount: it's the transaction amount (no balance column)
    let transactionAmount;
    let balance = null;

    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1].amount;
      transactionAmount = amounts[amounts.length - 2];
    } else {
      transactionAmount = amounts[0];
    }

    const amount = Math.abs(transactionAmount.amount);
    if (!amount || amount < 0.01) continue;

    // Extract description: text between date and first amount
    const dateMatch = DATE_PATTERNS.map(p => merged.match(p)).find(Boolean);
    const descStart = dateMatch ? dateMatch.index + dateMatch[0].length : 0;
    const descEnd = transactionAmount.index > descStart ? transactionAmount.index : merged.length;
    let rawDescription = merged.slice(descStart, descEnd).trim();

    // If description is too short, use the full merged text minus amounts
    if (rawDescription.length < 3) {
      rawDescription = merged
        .replace(/[\d,]+\.\d{2}/g, '')
        .replace(dateMatch ? dateMatch[0] : '', '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!rawDescription) continue;

    // Determine debit vs credit
    let type = 'expense';
    const marker = transactionAmount.marker;
    if (marker === 'cr') {
      type = 'income';
    } else if (marker === 'dr') {
      type = 'expense';
    } else {
      // Strong debit signals — these are almost always expenses
      const DEBIT_KEYWORDS = /\b(atm|withdrawal|purchase|pos|emi|auto.?debit|nach|ecs|ach|paid|payment|debit\s*card|bill\s*pay|mandate)\b/i;
      const CREDIT_KEYWORDS = /\b(cr|credit|deposit|refund|salary|received|interest\s*credit|neft\s*cr|cashback|reversal)\b/i;

      if (DEBIT_KEYWORDS.test(rawDescription)) {
        type = 'expense';
      } else if (CREDIT_KEYWORDS.test(rawDescription)) {
        type = 'income';
      } else {
        // Fall back to generic inference
        type = inferType(rawDescription, '');
      }
    }

    // Smart merchant extraction
    const merchant = extractSmartMerchant(rawDescription);
    const paymentMode = detectPaymentMode(rawDescription);
    const categoryResult = autoCategorizeFromDescription(rawDescription);
    const referenceNumber = extractReference(rawDescription);

    // Compute confidence score
    let confidence = 0.7; // base for block-parsed transactions
    if (date && amount && merchant !== 'Unknown Merchant') confidence = 0.85;
    if (amounts.length >= 2) confidence = Math.min(confidence + 0.05, 0.95); // balance column present = higher confidence
    if (block.lines.length > 5) confidence -= 0.1; // very long blocks = less certain

    const warnings = [];
    if (block.lines.length > 3) warnings.push('Multi-line block reconstructed');
    if (merchant === 'Unknown Merchant') warnings.push('Merchant could not be determined');
    if (marker !== 'cr' && marker !== 'dr' && type === 'expense') warnings.push('Debit/credit inferred from keywords');

    entries.push({
      rowNumber: block.startLine,
      date,
      amount,
      type,
      description: rawDescription,
      merchant,
      raw: block.lines.join('\n'),
      // Extended fields (backward-compatible — ignored by consumers that don't need them)
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
      paymentMode,
      referenceNumber,
      balance: balance !== null ? Math.abs(balance) : null,
      category: categoryResult.category,
    });
  }

  return entries;
}

/**
 * Primary PDF text parser with automatic fallback.
 * Tries the advanced block-based engine first;
 * if it yields zero results, falls back to the legacy line-by-line parser.
 */
function parseTextStatement(text) {
  const advanced = parseTextStatementAdvanced(text);
  if (advanced.length > 0) return advanced;
  // Fallback: the legacy parser may still catch simple single-line entries
  return parseTextStatementLegacy(text);
}

class StatementParserService {
  async extractPdfText(buffer) {
    let pdfParse;
    try {
      // Lazy require keeps CSV imports working even if the optional parser is not installed yet.
      pdfParse = require('pdf-parse');
    } catch {
      throw new ValidationError('PDF parsing dependency is missing. Run npm install in backend.', 'statement');
    }

    const data = await pdfParse(buffer);
    return data.text || '';
  }

  parseCsvStatement(text, mapping = null) {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return { entries: [], warnings: ['CSV file had no readable rows.'] };
    }

    const headerIndex = mapping ? mapping.headerIndex : rows.findIndex((row) => {
      const normalized = row.map(normalizeHeader);
      return findHeaderIndex(normalized, 'date') >= 0
        && (findHeaderIndex(normalized, 'description') >= 0 || findHeaderIndex(normalized, 'amount') >= 0);
    });

    if (headerIndex === -1 && !mapping) {
      return {
        entries: rows
          .map((row, index) => parseTextLine(row.join(' '), index + 1))
          .filter(Boolean),
        warnings: ['No CSV header matched known bank formats, so text-line inference was used.'],
      };
    }

    const headers = headerIndex >= 0 ? rows[headerIndex] : [];
    const indexes = mapping ? {
      date: mapping.date !== undefined ? mapping.date : -1,
      description: mapping.description !== undefined ? mapping.description : -1,
      debit: mapping.debit !== undefined ? mapping.debit : -1,
      credit: mapping.credit !== undefined ? mapping.credit : -1,
      amount: mapping.amount !== undefined ? mapping.amount : -1,
      type: mapping.type !== undefined ? mapping.type : -1,
    } : {
      date: findHeaderIndex(headers, 'date'),
      description: findHeaderIndex(headers, 'description'),
      debit: findHeaderIndex(headers, 'debit'),
      credit: findHeaderIndex(headers, 'credit'),
      amount: findHeaderIndex(headers, 'amount'),
      type: findHeaderIndex(headers, 'type'),
    };

    const entries = rows
      .slice(headerIndex >= 0 ? headerIndex + 1 : 0)
      .map((row, index) => mapCsvRow(row, indexes, (headerIndex >= 0 ? headerIndex : 0) + index + 2))
      .filter(Boolean);

    return { entries, warnings: [] };
  }

  async parseFile(file, mapping = null) {
    if (!file || !file.buffer) {
      throw new ValidationError('Statement file is required', 'statement');
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();
    const warnings = [];

    const isCsv = extension === '.csv' || mimeType.includes('csv') || mimeType.includes('plain');
    const isExcel = extension === '.xlsx' || extension === '.xls' || mimeType.includes('excel') || mimeType.includes('spreadsheet');

    if (isCsv || isExcel) {
      let text;
      if (isExcel) {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = xlsx.utils.sheet_to_csv(worksheet);
      } else {
        text = file.buffer.toString('utf8');
      }

      const parsed = this.parseCsvStatement(text, mapping);
      return {
        parser: 'csv',
        entries: parsed.entries,
        warnings: parsed.warnings,
      };
    }

    if (extension === '.pdf' || mimeType.includes('pdf')) {
      const text = await this.extractPdfText(file.buffer);
      if (!text.trim()) warnings.push('PDF text extraction returned no text. Scanned PDFs need OCR before import.');
      return {
        parser: 'pdf-text',
        entries: parseTextStatement(text),
        warnings,
      };
    }

    throw new ValidationError('Only PDF and CSV bank statements are supported.', 'statement');
  }

  async previewFile(file, mapping = null) {
    if (!file || !file.buffer) {
      throw new ValidationError('Statement file is required', 'statement');
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();

    const isCsv = extension === '.csv' || mimeType.includes('csv') || mimeType.includes('plain');
    const isExcel = extension === '.xlsx' || extension === '.xls' || mimeType.includes('excel') || mimeType.includes('spreadsheet');

    if (isCsv || isExcel) {
      let text;
      if (isExcel) {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = xlsx.utils.sheet_to_csv(worksheet);
      } else {
        text = file.buffer.toString('utf8');
      }
      
      // If a mapping is provided, do a dry-run of the parsed statement
      if (mapping) {
        const parsed = this.parseCsvStatement(text, mapping);
        const processedPreview = parsed.entries.slice(0, 5).map(entry => ({
          date: entry.date,
          merchant: entry.merchant,
          description: entry.description,
          amount: entry.amount,
          type: entry.type
        }));
        return { parser: 'csv', processedPreview, warnings: parsed.warnings, isPdf: false };
      }

      // Otherwise, return raw headers and auto-mapping
      const rows = parseCsv(text);
      if (rows.length === 0) return { parser: 'csv', headers: [], previewRows: [], autoMapping: {} };

      const headerIndex = rows.findIndex((row) => {
        const normalized = row.map(normalizeHeader);
        return findHeaderIndex(normalized, 'date') >= 0
          && (findHeaderIndex(normalized, 'description') >= 0 || findHeaderIndex(normalized, 'amount') >= 0);
      });

      const actualHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
      const headers = rows[actualHeaderIndex] || [];
      const previewRows = rows.slice(actualHeaderIndex + 1, actualHeaderIndex + 6);
      
      const autoMapping = {
        headerIndex: actualHeaderIndex,
        date: findHeaderIndex(headers.map(normalizeHeader), 'date'),
        description: findHeaderIndex(headers.map(normalizeHeader), 'description'),
        debit: findHeaderIndex(headers.map(normalizeHeader), 'debit'),
        credit: findHeaderIndex(headers.map(normalizeHeader), 'credit'),
        amount: findHeaderIndex(headers.map(normalizeHeader), 'amount'),
        type: findHeaderIndex(headers.map(normalizeHeader), 'type'),
      };

      // clean up -1
      Object.keys(autoMapping).forEach(k => {
        if (autoMapping[k] === -1) delete autoMapping[k];
      });

      return { parser: 'csv', headers, previewRows, autoMapping };
    }

    if (extension === '.pdf' || mimeType.includes('pdf')) {
      return { parser: 'pdf', headers: [], previewRows: [], autoMapping: {}, isPdf: true };
    }

    throw new ValidationError('Only PDF, CSV, and Excel bank statements are supported.', 'statement');
  }
}

module.exports = new StatementParserService();
module.exports._private = {
  parseDate,
  cleanDescription,
  deriveMerchant,
  parseCsv,
  parseTextStatement,
  parseTextStatementAdvanced,
  parseTextStatementLegacy,
  extractSmartMerchant,
  autoCategorizeFromDescription,
  extractReference,
  detectPaymentMode,
};
