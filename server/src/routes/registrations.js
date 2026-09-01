const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { evaluateSessionAlert } = require('../services/alertService');
const { checkAndExpireReservations } = require('../services/expiryService');

const router = express.Router();

// GET /api/registrations - Search, filter, sort, paginate registrations on server
router.get('/', authenticateToken, (req, res) => {
  try {
    // Auto-expire stale holding-window reservations before querying
    checkAndExpireReservations();

    const {
      search,
      eventId,
      sessionId,
      status,
      sortBy = 'reserved_at',
      sortOrder = 'DESC',
      page = 1,
      limit = 10
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    const whereConditions = [];

    // Role-based visibility check:
    // Check-in staff only see registrations for sessions they are assigned to!
    if (req.user.role === 'CHECKIN_STAFF') {
      whereConditions.push(`r.session_id IN (SELECT session_id FROM staff_assignments WHERE user_id = ?)`);
      params.push(req.user.id);
    }

    // Text search over attendee name and email
    if (search) {
      whereConditions.push(`(LOWER(r.attendee_name) LIKE LOWER(?) OR LOWER(r.attendee_email) LIKE LOWER(?))`);
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Filters
    if (eventId) {
      whereConditions.push(`s.event_id = ?`);
      params.push(eventId);
    }
    if (sessionId) {
      whereConditions.push(`r.session_id = ?`);
      params.push(sessionId);
    }
    if (status) {
      whereConditions.push(`r.status = ?`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sorting parameters
    const validSortColumns = {
      reserved_at: 'r.reserved_at',
      status: 'r.status',
      session_title: 's.title',
      attendee_name: 'r.attendee_name'
    };
    const sortColumn = validSortColumns[sortBy] || 'r.reserved_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query for total matching records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM registrations r
      JOIN sessions s ON r.session_id = s.id
      JOIN events e ON s.event_id = e.id
      ${whereClause}
    `;
    const totalCount = db.prepare(countQuery).get(...params).total;

    // Data query with pagination
    const dataQuery = `
      SELECT r.*, s.title as session_title, s.location as session_location, s.capacity as session_capacity, e.name as event_name, e.id as event_id
      FROM registrations r
      JOIN sessions s ON r.session_id = s.id
      JOIN events e ON s.event_id = e.id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT ? OFFSET ?
    `;

    const registrations = db.prepare(dataQuery).all(...params, parseInt(limit, 10), offset);

    res.json({
      registrations,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalCount / parseInt(limit, 10))
      }
    });
  } catch (err) {
    console.error('Fetch registrations error:', err);
    res.status(500).json({ error: 'Failed to retrieve registrations.' });
  }
});

// POST /api/registrations - Create new seat reservation
router.post('/', authenticateToken, (req, res) => {
  try {
    const { session_id, attendee_name, attendee_email, notes } = req.body;

    if (!session_id || !attendee_name || !attendee_email) {
      return res.status(400).json({ error: 'Session ID, attendee name, and email are required.' });
    }

    const cleanEmail = attendee_email.toLowerCase().trim();
    const cleanName = attendee_name.trim();

    // Check-in staff role check: can only reserve for assigned sessions
    if (req.user.role === 'CHECKIN_STAFF') {
      const assignment = db.prepare('SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?')
        .get(req.user.id, session_id);
      if (!assignment) {
        return res.status(403).json({ error: 'Permission denied. Staff can only register attendees for assigned sessions.' });
      }
    }

    // Get session & check capacity
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Count active seats (RESERVED + CONFIRMED + CHECKED_IN)
    const activeCount = db.prepare(`
      SELECT COUNT(*) as count FROM registrations
      WHERE session_id = ? AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
    `).get(session_id).count;

    if (activeCount >= session.capacity) {
      return res.status(400).json({
        error: `Session '${session.title}' is currently full at capacity (${session.capacity}/${session.capacity} seats taken).`
      });
    }

    // Prevent duplicate active registration for same email in same session
    const existingActive = db.prepare(`
      SELECT id, status FROM registrations
      WHERE session_id = ? AND LOWER(attendee_email) = ? AND status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN')
    `).get(session_id, cleanEmail);

    if (existingActive) {
      return res.status(400).json({
        error: `Attendee with email '${cleanEmail}' is already registered for this session (Status: ${existingActive.status}).`
      });
    }

    // Execute within database transaction
    let newRegistrationId;
    db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO registrations (session_id, attendee_name, attendee_email, status, reserved_at)
        VALUES (?, ?, ?, 'RESERVED', CURRENT_TIMESTAMP)
      `).run(session_id, cleanName, cleanEmail);

      newRegistrationId = result.lastInsertRowid;

      // Log immutable timeline history
      db.prepare(`
        INSERT INTO registration_history (registration_id, old_status, new_status, actor_id, actor_name, notes)
        VALUES (?, NULL, 'RESERVED', ?, ?, ?)
      `).run(newRegistrationId, req.user.id, req.user.name, notes || 'Created new seat reservation');
    })();

    // Evaluate at-capacity alerts for session
    evaluateSessionAlert(session_id);

    const registration = db.prepare(`
      SELECT r.*, s.title as session_title, e.name as event_name
      FROM registrations r
      JOIN sessions s ON r.session_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE r.id = ?
    `).get(newRegistrationId);

    res.status(201).json({ message: 'Reservation created successfully', registration });
  } catch (err) {
    console.error('Create registration error:', err);
    res.status(500).json({ error: 'Failed to create registration.' });
  }
});

// PATCH /api/registrations/:id/status - State transition rules
router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const { newStatus, notes } = req.body;
    const regId = req.params.id;

    if (!newStatus || !['CONFIRMED', 'CHECKED_IN', 'CANCELLED'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid target status. Allowed: CONFIRMED, CHECKED_IN, CANCELLED.' });
    }

    const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(regId);
    if (!reg) {
      return res.status(404).json({ error: 'Registration record not found.' });
    }

    // Check-in staff access restriction
    if (req.user.role === 'CHECKIN_STAFF') {
      const assignment = db.prepare('SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?')
        .get(req.user.id, reg.session_id);
      if (!assignment) {
        return res.status(403).json({ error: 'Permission denied. Staff can only manage registrations for assigned sessions.' });
      }
    }

    const currentStatus = reg.status;

    // Strict State Machine Guard Rules:
    // Rule A: Cannot change status of an already EXPIRED or CANCELLED registration
    if (['EXPIRED', 'CANCELLED'].includes(currentStatus)) {
      return res.status(400).json({
        error: `Cannot update a registration that is already ${currentStatus}.`
      });
    }

    // Rule B: Cannot CANCEL a registration once it is CHECKED_IN
    if (currentStatus === 'CHECKED_IN' && newStatus === 'CANCELLED') {
      return res.status(400).json({
        error: 'Illegal action: A registration that is already Checked In cannot be Cancelled.'
      });
    }

    // Rule C: Same status transition is redundant
    if (currentStatus === newStatus) {
      return res.status(400).json({
        error: `Registration is already in '${currentStatus}' status.`
      });
    }

    // Prepare timestamp updates
    let timestampField = '';
    if (newStatus === 'CONFIRMED') timestampField = ', confirmed_at = CURRENT_TIMESTAMP';
    if (newStatus === 'CHECKED_IN') timestampField = ', checked_in_at = CURRENT_TIMESTAMP';
    if (newStatus === 'CANCELLED') timestampField = ', cancelled_at = CURRENT_TIMESTAMP';

    // Execute state update & append immutable history log within transaction
    db.transaction(() => {
      db.prepare(`
        UPDATE registrations
        SET status = ? ${timestampField}
        WHERE id = ?
      `).run(newStatus, regId);

      db.prepare(`
        INSERT INTO registration_history (registration_id, old_status, new_status, actor_id, actor_name, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(regId, currentStatus, newStatus, req.user.id, req.user.name, notes || `Status changed from ${currentStatus} to ${newStatus}`);
    })();

    // Evaluate capacity alerts after status change
    evaluateSessionAlert(reg.session_id);

    const updated = db.prepare(`
      SELECT r.*, s.title as session_title, e.name as event_name
      FROM registrations r
      JOIN sessions s ON r.session_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE r.id = ?
    `).get(regId);

    res.json({ message: `Status updated from ${currentStatus} to ${newStatus}`, registration: updated });
  } catch (err) {
    console.error('Update registration status error:', err);
    res.status(500).json({ error: 'Failed to update registration status.' });
  }
});

// GET /api/registrations/:id/history - Immutable audit log timeline
router.get('/:id/history', authenticateToken, (req, res) => {
  try {
    const regId = req.params.id;

    const reg = db.prepare('SELECT r.*, s.title as session_title FROM registrations r JOIN sessions s ON r.session_id = s.id WHERE r.id = ?')
      .get(regId);
    if (!reg) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    // Check staff access
    if (req.user.role === 'CHECKIN_STAFF') {
      const assignment = db.prepare('SELECT id FROM staff_assignments WHERE user_id = ? AND session_id = ?')
        .get(req.user.id, reg.session_id);
      if (!assignment) {
        return res.status(403).json({ error: 'Permission denied. Staff can only view history for assigned sessions.' });
      }
    }

    const history = db.prepare(`
      SELECT h.*, u.role as actor_role
      FROM registration_history h
      LEFT JOIN users u ON h.actor_id = u.id
      WHERE h.registration_id = ?
      ORDER BY h.created_at ASC
    `).all(regId);

    res.json({ registration: reg, history });
  } catch (err) {
    console.error('Fetch registration history error:', err);
    res.status(500).json({ error: 'Failed to retrieve registration history timeline.' });
  }
});

module.exports = router;
