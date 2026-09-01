const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../eventhub.db');
const db = new Database(dbPath);

// Enable Foreign Key Enforcement
db.pragma('foreign_keys = ON');

// Initialize Database Tables
function initDb() {
  db.exec(`
    -- Users Table (Organizers and Check-in Staff)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('ORGANIZER', 'CHECKIN_STAFF')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Events Table
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      venue TEXT NOT NULL,
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions Table
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK(capacity > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    -- Staff Assignments Table
    CREATE TABLE IF NOT EXISTS staff_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, session_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- Registrations Table
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      attendee_name TEXT NOT NULL,
      attendee_email TEXT NOT NULL,
      status TEXT CHECK(status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'EXPIRED', 'CANCELLED')) NOT NULL DEFAULT 'RESERVED',
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      checked_in_at DATETIME,
      expired_at DATETIME,
      cancelled_at DATETIME,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- Registration Timeline / Audit Log Table (Immutable)
    CREATE TABLE IF NOT EXISTS registration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Session Alerts Table (At-Capacity Alerts)
    CREATE TABLE IF NOT EXISTS session_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      is_dismissed INTEGER DEFAULT 0,
      capacity_count INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- Indexes for efficient querying, filtering, and search
    CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(attendee_email);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
    CREATE INDEX IF NOT EXISTS idx_history_registration ON registration_history(registration_id);
    CREATE INDEX IF NOT EXISTS idx_staff_user ON staff_assignments(user_id);
  `);

  console.log('Database initialized successfully.');
}

initDb();

module.exports = db;
