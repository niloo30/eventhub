const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const db = require('../db/database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Required role: ${roles.join(' or ')}. Your role: ${req.user ? req.user.role : 'None'}`
      });
    }
    next();
  };
}

// Middleware to check if check-in staff is assigned to a specific session
function checkStaffSessionAccess(req, res, next) {
  if (req.user.role === 'ORGANIZER') {
    return next(); // Organizers have full access to all sessions
  }

  const sessionId = req.params.sessionId || req.body.sessionId || req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required to verify staff permission.' });
  }

  const assignment = db.prepare(`
    SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?
  `).get(req.user.id, sessionId);

  if (!assignment) {
    return res.status(403).json({
      error: 'Permission denied. Check-in staff can only access registrations for assigned sessions.'
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  checkStaffSessionAccess
};
