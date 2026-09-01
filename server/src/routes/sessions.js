const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { evaluateSessionAlert } = require('../services/alertService');

const router = express.Router();

// GET /api/sessions - List all sessions or filter by eventId
router.get('/', authenticateToken, (req, res) => {
  try {
    const { eventId } = req.query;

    let query = `
      SELECT s.*, e.name as event_name, e.venue as event_venue,
        (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_registrations_count,
        (SELECT COUNT(*) FROM staff_assignments sa WHERE sa.session_id = s.id) as assigned_staff_count
      FROM sessions s
      JOIN events e ON s.event_id = e.id
    `;
    const params = [];

    if (eventId) {
      query += ' WHERE s.event_id = ?';
      params.push(eventId);
    }

    query += ' ORDER BY s.start_time ASC';

    const sessions = db.prepare(query).all(...params);
    res.json({ sessions });
  } catch (err) {
    console.error('Fetch sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
});

// GET /api/sessions/:id - Single session details
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT s.*, e.name as event_name, e.venue as event_venue,
        (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_registrations_count
      FROM sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Get assigned staff members
    const assignedStaff = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM staff_assignments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.session_id = ?
    `).all(session.id);

    res.json({ session, assignedStaff });
  } catch (err) {
    console.error('Fetch session details error:', err);
    res.status(500).json({ error: 'Failed to retrieve session details.' });
  }
});

// POST /api/sessions - Create session (ORGANIZER ONLY)
router.post('/', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const { event_id, title, start_time, duration_mins, location, capacity } = req.body;

    if (!event_id || !title || !start_time || !duration_mins || !location || !capacity) {
      return res.status(400).json({
        error: 'Event ID, title, start time, duration, location, and capacity are required.'
      });
    }

    if (parseInt(capacity, 10) <= 0) {
      return res.status(400).json({ error: 'Capacity must be greater than 0.' });
    }

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Associated event not found.' });
    }

    const result = db.prepare(`
      INSERT INTO sessions (event_id, title, start_time, duration_mins, location, capacity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(event_id, title, start_time, parseInt(duration_mins, 10), location, parseInt(capacity, 10));

    const newSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Session created successfully', session: newSession });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session.' });
  }
});

// PUT /api/sessions/:id - Edit session (ORGANIZER ONLY)
router.put('/:id', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const sessionId = req.params.id;
    const { title, start_time, duration_mins, location, capacity } = req.body;

    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (!title || !start_time || !duration_mins || !location || !capacity) {
      return res.status(400).json({
        error: 'Title, start time, duration, location, and capacity are required.'
      });
    }

    const newCapacity = parseInt(capacity, 10);
    if (newCapacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be greater than 0.' });
    }

    db.prepare(`
      UPDATE sessions
      SET title = ?, start_time = ?, duration_mins = ?, location = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, start_time, parseInt(duration_mins, 10), location, newCapacity, sessionId);

    // Re-evaluate capacity alerts for this session
    evaluateSessionAlert(sessionId);

    const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    res.json({ message: 'Session updated successfully', session: updated });
  } catch (err) {
    console.error('Edit session error:', err);
    res.status(500).json({ error: 'Failed to update session.' });
  }
});

// DELETE /api/sessions/:id - Delete session (ORGANIZER ONLY)
router.delete('/:id', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const sessionId = req.params.id;
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

    if (!existing) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    res.json({ message: 'Session deleted successfully' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

module.exports = router;
