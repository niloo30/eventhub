const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getActiveAlerts } = require('../services/alertService');

const router = express.Router();

// GET /api/alerts - Get active at-capacity alerts & badge count
router.get('/', authenticateToken, (req, res) => {
  try {
    const alerts = getActiveAlerts();
    res.json({
      alerts,
      badgeCount: alerts.length
    });
  } catch (err) {
    console.error('Fetch alerts error:', err);
    res.status(500).json({ error: 'Failed to retrieve capacity alerts.' });
  }
});

// PATCH /api/alerts/:id/dismiss - Dismiss an alert (ORGANIZER ONLY)
router.patch('/:id/dismiss', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const alertId = req.params.id;

    const alert = db.prepare('SELECT * FROM session_alerts WHERE id = ?').get(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert record not found.' });
    }

    db.prepare(`
      UPDATE session_alerts
      SET is_dismissed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(alertId);

    res.json({ message: 'Alert dismissed successfully' });
  } catch (err) {
    console.error('Dismiss alert error:', err);
    res.status(500).json({ error: 'Failed to dismiss alert.' });
  }
});

module.exports = router;
