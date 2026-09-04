'use strict';

const jwt = require('jsonwebtoken');

function createAuth({ jwtSecret, jwtExpiresIn }) {
  function signToken(user) {
    return jwt.sign(
      { sub: String(user.id), role: user.role, name: user.name },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: jwtExpiresIn }
    );
  }

  function authenticateToken(req, res, next) {
    const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Authentication required' });

    try {
      req.user = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission to perform this action' });
      }
      return next();
    };
  }

  return { authenticateToken, requireRole, signToken };
}

module.exports = { createAuth };
