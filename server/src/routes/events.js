const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/events - List events (filtered by archived status)
router.get('/', authenticateToken, (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';

    let query = `
      SELECT e.*, 
        (SELECT COUNT(*) FROM sessions s WHERE s.event_id = e.id) as session_count,
        (SELECT COUNT(*) FROM registrations r JOIN sessions s2 ON r.session_id = s2.id WHERE s2.event_id = e.id) as total_registrations
      FROM events e
    `;

    if (!includeArchived) {
      query += ' WHERE e.is_archived = 0';
    }

    query += ' ORDER BY e.start_date ASC';

    const events = db.prepare(query).all();
    res.json({ events });
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'Failed to retrieve events.' });
  }
});

// GET /api/events/:id - Get single event with its sessions
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const sessions = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')) as active_registrations_count
      FROM sessions s
      WHERE s.event_id = ?
      ORDER BY s.start_time ASC
    `).all(event.id);

    res.json({ event, sessions });
  } catch (err) {
    console.error('Fetch event details error:', err);
    res.status(500).json({ error: 'Failed to retrieve event details.' });
  }
});

// POST /api/events - Create new event (ORGANIZER ONLY)
router.post('/', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const { name, description, start_date, end_date, venue } = req.body;

    if (!name || !start_date || !end_date || !venue) {
      return res.status(400).json({ error: 'Event name, start date, end date, and venue are required.' });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }

    const result = db.prepare(`
      INSERT INTO events (name, description, start_date, end_date, venue, is_archived)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(name, description || '', start_date, end_date, venue);

    const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Event created successfully', event: newEvent });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// PUT /api/events/:id - Edit event (ORGANIZER ONLY)
router.put('/:id', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const { name, description, start_date, end_date, venue } = req.body;
    const eventId = req.params.id;

    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (!name || !start_date || !end_date || !venue) {
      return res.status(400).json({ error: 'Event name, start date, end date, and venue are required.' });
    }

    db.prepare(`
      UPDATE events
      SET name = ?, description = ?, start_date = ?, end_date = ?, venue = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description || '', start_date, end_date, venue, eventId);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    res.json({ message: 'Event updated successfully', event: updated });
  } catch (err) {
    console.error('Edit event error:', err);
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

// PATCH /api/events/:id/archive - Toggle archive status (ORGANIZER ONLY)
router.patch('/:id/archive', authenticateToken, requireRole('ORGANIZER'), (req, res) => {
  try {
    const eventId = req.params.id;
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);

    if (!existing) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const newArchivedState = existing.is_archived ? 0 : 1;

    db.prepare(`
      UPDATE events
      SET is_archived = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newArchivedState, eventId);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    res.json({
      message: newArchivedState ? 'Event archived successfully' : 'Event restored successfully',
      event: updated
    });
  } catch (err) {
    console.error('Archive event error:', err);
    res.status(500).json({ error: 'Failed to toggle event archive status.' });
  }
});

module.exports = router;
