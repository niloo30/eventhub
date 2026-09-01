const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { checkAndExpireReservations } = require('../services/expiryService');

const router = express.Router();

// GET /api/dashboard/stats - Return headline numbers, breakdowns, and 14-day check-in chart
router.get('/stats', authenticateToken, (req, res) => {
  try {
    // Run auto-expiry before generating dashboard statistics
    checkAndExpireReservations();

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Sessions Today
    const sessionsToday = db.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE DATE(start_time) = DATE('now', 'localtime') OR DATE(start_time) = ?
    `).get(todayStr).count;

    // 2. Attendees Checked In Today
    const checkedInToday = db.prepare(`
      SELECT COUNT(*) as count FROM registrations
      WHERE status = 'CHECKED_IN'
        AND (DATE(checked_in_at) = DATE('now', 'localtime') OR DATE(checked_in_at) = ?)
    `).get(todayStr).count;

    // 3. Registrations Expired This Week (Last 7 days)
    const expiredThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM registrations
      WHERE status = 'EXPIRED'
        AND expired_at >= DATETIME('now', '-7 days')
    `).get().count;

    // 4. Sessions Currently At Capacity
    const sessionsAtCapacity = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT s.id, s.capacity,
          (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_count
        FROM sessions s
        JOIN events e ON s.event_id = e.id
        WHERE e.is_archived = 0
      ) WHERE active_count >= capacity
    `).get().count;

    // 5. Breakdown by Status
    const statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM registrations
      GROUP BY status
    `).all();

    // 6. Breakdown by Session
    const sessionBreakdown = db.prepare(`
      SELECT s.id as session_id, s.title as session_title, s.capacity, e.name as event_name,
        SUM(CASE WHEN r.status = 'RESERVED' THEN 1 ELSE 0 END) as reserved_count,
        SUM(CASE WHEN r.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN r.status = 'CHECKED_IN' THEN 1 ELSE 0 END) as checked_in_count,
        SUM(CASE WHEN r.status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN r.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
      FROM sessions s
      JOIN events e ON s.event_id = e.id
      LEFT JOIN registrations r ON r.session_id = s.id
      WHERE e.is_archived = 0
      GROUP BY s.id
      ORDER BY s.title ASC
    `).all();

    // 7. 14-Day Check-ins Chart Data (Check-ins per day over the last 14 days)
    const checkinsLast14Days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const count = db.prepare(`
        SELECT COUNT(*) as count
        FROM registrations
        WHERE status = 'CHECKED_IN'
          AND DATE(checked_in_at) = ?
      `).get(dateStr).count;

      checkinsLast14Days.push({
        date: dateStr,
        displayDate,
        checkIns: count
      });
    }

    res.json({
      headlineStats: {
        sessionsToday,
        checkedInToday,
        expiredThisWeek,
        sessionsAtCapacity
      },
      statusBreakdown,
      sessionBreakdown,
      checkinsLast14Days
    });
  } catch (err) {
    console.error('Fetch dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to generate dashboard metrics.' });
  }
});

module.exports = router;
