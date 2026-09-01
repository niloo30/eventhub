const db = require('../db/database');

function evaluateSessionAlert(sessionId) {
  // Get session capacity
  const session = db.prepare('SELECT id, capacity FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return;

  // Count active seats (RESERVED + CONFIRMED + CHECKED_IN)
  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM registrations
    WHERE session_id = ? AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
  `).get(sessionId).count;

  const existingAlert = db.prepare('SELECT * FROM session_alerts WHERE session_id = ?').get(sessionId);

  if (activeCount >= session.capacity) {
    if (!existingAlert) {
      // Create new alert
      db.prepare(`
        INSERT INTO session_alerts (session_id, is_dismissed, capacity_count)
        VALUES (?, 0, ?)
      `).run(sessionId, activeCount);
    } else {
      // If alert exists, check if it was dismissed and capacity dropped previously then refilled
      // We re-trigger the alert if capacity count changed from below capacity back to >= capacity
      if (existingAlert.is_dismissed && existingAlert.capacity_count < session.capacity) {
        db.prepare(`
          UPDATE session_alerts
          SET is_dismissed = 0, capacity_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(activeCount, existingAlert.id);
      } else {
        db.prepare(`
          UPDATE session_alerts
          SET capacity_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(activeCount, existingAlert.id);
      }
    }
  } else {
    // If active count dropped below capacity, update capacity_count on the alert record
    if (existingAlert) {
      db.prepare(`
        UPDATE session_alerts
        SET capacity_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(activeCount, existingAlert.id);
    }
  }
}

function getActiveAlerts() {
  // Return alerts where session is currently at or over capacity and alert is not dismissed
  return db.prepare(`
    SELECT a.*, s.title as session_title, s.capacity, e.name as event_name
    FROM session_alerts a
    JOIN sessions s ON a.session_id = s.id
    JOIN events e ON s.event_id = e.id
    WHERE a.is_dismissed = 0
      AND (
        SELECT COUNT(*) FROM registrations r
        WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
      ) >= s.capacity
    ORDER BY a.updated_at DESC
  `).all();
}

module.exports = {
  evaluateSessionAlert,
  getActiveAlerts
};
