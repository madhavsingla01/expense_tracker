const jwt = require('jsonwebtoken');

const generateToken = (userId, sessionId = null) => {
  return jwt.sign({ id: userId, sid: sessionId || undefined }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = generateToken;
