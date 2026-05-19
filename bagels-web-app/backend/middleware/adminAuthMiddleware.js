function parseBasicAuth(headerValue) {
  if (!headerValue || !headerValue.startsWith('Basic ')) return null;

  try {
    const encoded = headerValue.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function adminBasicAuth(req, res, next) {
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const credentials = parseBasicAuth(req.headers.authorization);

  if (
    credentials &&
    credentials.username === expectedUsername &&
    credentials.password === expectedPassword
  ) {
    req.adminUser = { username: expectedUsername };
    res.locals.adminUser = req.adminUser;
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="CASH CLAIR Admin"');
  return res.status(401).send('Admin authentication required.');
}

module.exports = { adminBasicAuth };
