const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 300;
const AUTH_LIMIT = 40;
const buckets = new Map();

function clientKey(req) {
  return [
    req.ip,
    req.headers['x-forwarded-for'],
    req.headers['user-agent'],
  ].filter(Boolean).join('|');
}

function rateLimit({ windowMs = WINDOW_MS, max = DEFAULT_LIMIT } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
      return;
    }

    next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; frame-src https://api.razorpay.com https://checkout.razorpay.com"
  );
  next();
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;

  Object.keys(value).forEach((key) => {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      return;
    }
    value[key] = sanitizeValue(value[key]);
  });

  return value;
}

function sanitizeRequest(req, res, next) {
  sanitizeValue(req.body);
  sanitizeValue(req.query);
  sanitizeValue(req.params);
  next();
}

module.exports = {
  rateLimit,
  securityHeaders,
  sanitizeRequest,
  authRateLimit: rateLimit({ max: AUTH_LIMIT }),
};
