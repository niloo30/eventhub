const db = require('../db/database');
const { HOLDING_WINDOW_MINUTES } = require('../config/jwt');
const { evaluateSessionAlert } = require('./alertService');

function checkAndExpireReservations(windowMinutes = HOLDING_WINDOW_MINUTES) {
  // Find reservations that are still RESERVED and created older than windowMinutes ago
  const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const expiredCandidates = db.prepare(`
    SELECT id, session_id, attendee_email, attendee_name
    FROM registrations
    WHERE status = 'RESERVED' AND reserved_at <= ?
  `).all(cutoffTime);

  if (expiredCandidates.length === 0) {
    return [];
  }

  const updateStatusStmt = db.prepare(`
    UPDATE registrations
    SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const insertHistoryStmt = db.prepare(`
    INSERT INTO registration_history (registration_id, old_status, new_status, actor_id, actor_name, notes)
    VALUES (?, 'RESERVED', 'EXPIRED', NULL, 'System (Auto-Expiry)', ?)
  `);

  const expiredIds = [];
  const affectedSessionIds = new Set();

  db.transaction(() => {
    for (const reg of expiredCandidates) {
      updateStatusStmt.run(reg.id);
      insertHistoryStmt.run(
        reg.id,
        `Holding window expired (${windowMinutes} mins elapsed without confirmation)`
      );
      expiredIds.push(reg.id);
      affectedSessionIds.add(reg.session_id);
    }
  })();

  // Re-evaluate alerts for affected sessions
  for (const sessionId of affectedSessionIds) {
    evaluateSessionAlert(sessionId);
  }

  if (expiredIds.length > 0) {
    console.log(`Auto-expired ${expiredIds.length} stale reservations.`);
  }

  return expiredIds;
}

module.exports = {
  checkAndExpireReservations
};
