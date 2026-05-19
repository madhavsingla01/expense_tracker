const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request (exclude password)
      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        res.status(401);
        throw new Error('User not found');
      }

      if (decoded.sid) {
        const activeSession = user.auth?.sessions?.find(
          (session) => session.sessionId === decoded.sid && !session.revokedAt && (!session.expiresAt || session.expiresAt > new Date())
        );

        if (!activeSession) {
          res.status(401);
          throw new Error('Session expired or revoked');
        }

        const now = new Date();
        if (!activeSession.lastSeenAt || now - activeSession.lastSeenAt > 5 * 60 * 1000) {
          activeSession.lastSeenAt = now;
          await user.save();
        }
      }

      req.auth = { sessionId: decoded.sid || null };
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token invalid' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
