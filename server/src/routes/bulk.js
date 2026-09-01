const express = require('express');
const Papa = require('papaparse');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { evaluateSessionAlert } = require('../services/alertService');

const router = express.Router();

// Helper to validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/bulk/import/:sessionId - Bulk import attendees from CSV (ORGANIZER ONLY)
router.post('/import/:sessionId', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { csvContent } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'CSV content text is required in body field `csvContent`.' });
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Parse CSV content
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase()
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.warn('CSV parsing warnings:', parsed.errors);
    }

    const rows = parsed.data;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no valid rows.' });
    }

    // Track per-row report results
    const report = {
      totalRows: rows.length,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      rowResults: []
    };

    // Fetch current active count
    let currentActive = db.prepare(`
      SELECT COUNT(*) as count FROM registrations
      WHERE session_id = ? AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
    `).get(sessionId).count;

    const capacity = session.capacity;

    const insertRegStmt = db.prepare(`
      INSERT INTO registrations (session_id, attendee_name, attendee_email, status, reserved_at)
      VALUES (?, ?, ?, 'RESERVED', CURRENT_TIMESTAMP)
    `);

    const insertHistoryStmt = db.prepare(`
      INSERT INTO registration_history (registration_id, old_status, new_status, actor_id, actor_name, notes)
      VALUES (?, NULL, 'RESERVED', ?, ?, 'Bulk CSV import reservation')
    `);

    // Process each row
    for (let index = 0; index < rows.length; index++) {
      const rowNum = index + 1;
      const row = rows[index];

      const name = (row.name || row.attendee_name || row['full name'] || '').trim();
      const email = (row.email || row.attendee_email || '').trim().toLowerCase();

      // Check 1: Missing or invalid fields
      if (!name || !email) {
        report.rejectedCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'REJECTED',
          reason: 'Missing name or email column'
        });
        continue;
      }

      if (!isValidEmail(email)) {
        report.rejectedCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'REJECTED',
          reason: 'Invalid email address format'
        });
        continue;
      }

      // Check 2: Check duplicate active registration for same email in session
      const existing = db.prepare(`
        SELECT id, status FROM registrations
        WHERE session_id = ? AND LOWER(attendee_email) = ? AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
      `).get(sessionId, email);

      if (existing) {
        report.duplicateCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'DUPLICATE',
          reason: `Already registered for this session (Status: ${existing.status})`
        });
        continue;
      }

      // Check 3: Room capacity check
      if (currentActive >= capacity) {
        report.rejectedCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'REJECTED',
          reason: `Session reached maximum seat capacity (${capacity}/${capacity})`
        });
        continue;
      }

      // Create reservation for valid row
      try {
        db.transaction(() => {
          const res = insertRegStmt.run(sessionId, name, email);
          insertHistoryStmt.run(res.lastInsertRowid, req.user.id, req.user.name);
          currentActive++;
        })();

        report.createdCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'CREATED',
          reason: 'Successfully reserved seat'
        });
      } catch (err) {
        report.rejectedCount++;
        report.rowResults.push({
          row: rowNum,
          name,
          email,
          status: 'REJECTED',
          reason: `Database error: ${err.message}`
        });
      }
    }

    // Evaluate capacity alerts after import
    evaluateSessionAlert(sessionId);

    res.json({
      message: `CSV import completed: ${report.createdCount} created, ${report.duplicateCount} duplicates, ${report.rejectedCount} rejected.`,
      report
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to process CSV import.' });
  }
});

// GET /api/bulk/export/:sessionId - Export session check-in sheet as CSV
router.get('/export/:sessionId', authenticateToken, (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    const session = db.prepare(`
      SELECT s.*, e.name as event_name
      FROM sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Check-in staff authorization check
    if (req.user.role === 'CHECKIN_STAFF') {
      const assignment = db.prepare('SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?')
        .get(req.user.id, sessionId);
      if (!assignment) {
        return res.status(403).json({ error: 'Permission denied. Staff can only export check-in sheets for assigned sessions.' });
      }
    }

    const registrations = db.prepare(`
      SELECT r.id as registration_id, r.attendee_name, r.attendee_email, r.status,
        r.reserved_at, r.confirmed_at, r.checked_in_at
      FROM registrations r
      WHERE r.session_id = ?
      ORDER BY r.attendee_name ASC
    `).all(sessionId);

    // Format CSV using PapaParse
    const csvData = registrations.map(reg => ({
      'Registration ID': reg.registration_id,
      'Attendee Name': reg.attendee_name,
      'Attendee Email': reg.attendee_email,
      'Status': reg.status,
      'Event Name': session.event_name,
      'Session Title': session.title,
      'Location': session.location,
      'Reserved Time': reg.reserved_at || '',
      'Confirmed Time': reg.confirmed_at || '',
      'Checked In Time': reg.checked_in_at || ''
    }));

    const csvOutput = Papa.unparse(csvData);
    const filename = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_checkin_sheet.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvOutput);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export check-in sheet.' });
  }
});

module.exports = router;
