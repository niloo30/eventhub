const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff - List all staff users and assignments (ORGANIZER ONLY)
router.get('/', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const staffMembers = db.prepare(`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE role = 'CHECKIN_STAFF'
      ORDER BY name ASC
    `).all();

    const staffWithAssignments = staffMembers.map(staff => {
      const assignments = db.prepare(`
        SELECT sa.id as assignment_id, s.id as session_id, s.title as session_title, e.name as event_name, s.start_time
        FROM staff_assignments sa
        JOIN sessions s ON sa.session_id = s.id
        JOIN events e ON s.event_id = e.id
        WHERE sa.user_id = ?
        ORDER BY s.start_time ASC
      `).all(staff.id);
      return { ...staff, assignments };
    });

    res.json({ staffMembers: staffWithAssignments });
  } catch (err) {
    console.error('Fetch staff error:', err);
    res.status(500).json({ error: 'Failed to retrieve staff list.' });
  }
});

// POST /api/staff/assign - Assign staff member to session (ORGANIZER ONLY)
router.post('/assign', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const { user_id, session_id } = req.body;

    if (!user_id || !session_id) {
      return res.status(400).json({ error: 'User ID and Session ID are required.' });
    }

    const targetUser = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.role !== 'CHECKIN_STAFF') {
      return res.status(400).json({ error: 'Assignments can only be assigned to check-in staff members.' });
    }

    const session = db.prepare('SELECT id, title FROM sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const existing = db.prepare('SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?')
      .get(user_id, session_id);
    if (existing) {
      return res.status(400).json({ error: `${targetUser.name} is already assigned to '${session.title}'.` });
    }

    db.prepare('INSERT INTO staff_assignments (user_id, session_id) VALUES (?, ?)').run(user_id, session_id);

    res.status(201).json({
      message: `Assigned ${targetUser.name} to session '${session.title}'`
    });
  } catch (err) {
    console.error('Assign staff error:', err);
    res.status(500).json({ error: 'Failed to assign staff member.' });
  }
});

// DELETE /api/staff/assign - Remove staff assignment (ORGANIZER ONLY)
router.delete('/assign', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const { user_id, session_id } = req.body;

    if (!user_id || !session_id) {
      return res.status(400).json({ error: 'User ID and Session ID are required.' });
    }

    const result = db.prepare('DELETE FROM staff_assignments WHERE user_id = ? AND session_id = ?')
      .run(user_id, session_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Assignment record not found.' });
    }

    res.json({ message: 'Staff assignment removed successfully.' });
  } catch (err) {
    console.error('Remove staff assignment error:', err);
    res.status(500).json({ error: 'Failed to remove staff assignment.' });
  }
});

// GET /api/staff/my-sessions - List assigned sessions for current logged in staff member
router.get('/my-sessions', authenticateToken, (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'ORGANIZER') {
      // Organizers see all sessions
      query = `
        SELECT s.*, e.name as event_name, e.venue as event_venue,
          (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_registrations_count
        FROM sessions s
        JOIN events e ON s.event_id = e.id
        WHERE e.is_archived = 0
        ORDER BY s.start_time ASC
      `;
    } else {
      // Staff see only assigned sessions
      query = `
        SELECT s.*, e.name as event_name, e.venue as event_venue,
          (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_registrations_count
        FROM staff_assignments sa
        JOIN sessions s ON sa.session_id = s.id
        JOIN events e ON s.event_id = e.id
        WHERE sa.user_id = ? AND e.is_archived = 0
        ORDER BY s.start_time ASC
      `;
      params.push(req.user.id);
    }

    const assignedSessions = db.prepare(query).all(...params);
    res.json({ sessions: assignedSessions });
  } catch (err) {
    console.error('Fetch my-sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve assigned sessions.' });
  }
});

module.exports = router;
