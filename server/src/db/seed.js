const bcrypt = require('bcryptjs');
const db = require('./database');

async function seed() {
  console.log('Seeding database with demo data...');

  // Clear existing data
  db.exec(`
    DELETE FROM session_alerts;
    DELETE FROM registration_history;
    DELETE FROM registrations;
    DELETE FROM staff_assignments;
    DELETE FROM sessions;
    DELETE FROM events;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)
  `);

  const organizerRes = insertUser.run('organizer@eventhub.com', passwordHash, 'Sarah Jenkins', 'ORGANIZER');
  const organizerId = organizerRes.lastInsertRowid;

  const staffRes1 = insertUser.run('staff@eventhub.com', passwordHash, 'John Miller', 'CHECKIN_STAFF');
  const staff1Id = staffRes1.lastInsertRowid;

  const staffRes2 = insertUser.run('emma@eventhub.com', passwordHash, 'Emma Watson', 'CHECKIN_STAFF');
  const staff2Id = staffRes2.lastInsertRowid;

  // 2. Seed Events
  const insertEvent = db.prepare(`
    INSERT INTO events (name, description, start_date, end_date, venue, is_archived) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const event1 = insertEvent.run(
    'TechInnovate Global Conference 2026',
    'Premier annual conference covering cloud architecture, distributed systems, and modern web development.',
    '2026-09-10',
    '2026-09-14',
    'Silicon Convention Center, Hall A',
    0
  );

  const event2 = insertEvent.run(
    'AI & Machine Learning Symposium',
    'A deep dive into generative AI models, LLM orchestration, and intelligent agent systems.',
    '2026-09-20',
    '2026-09-22',
    'Metropolitan Expo Center',
    0
  );

  const event3 = insertEvent.run(
    'Annual Developers Meetup 2025',
    'Archived gathering of local developer communities from last winter.',
    '2025-12-01',
    '2025-12-03',
    'Grand Auditorium',
    1
  );

  // 3. Seed Sessions
  const insertSession = db.prepare(`
    INSERT INTO sessions (event_id, title, start_time, duration_mins, location, capacity) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const s1 = insertSession.run(event1.lastInsertRowid, 'Keynote: Architecting Scalable Cloud Systems', '2026-09-10T09:00:00Z', 90, 'Main Stage', 40);
  const s2 = insertSession.run(event1.lastInsertRowid, 'Hands-on Node.js & Database Micro-optimization', '2026-09-10T11:00:00Z', 60, 'Workshop Room 101', 5); // Capacity 5 - filled to trigger alert!
  const s3 = insertSession.run(event2.lastInsertRowid, 'Generative AI & Agentic Workflows', '2026-09-20T10:00:00Z', 120, 'Auditorium B', 50);
  const s4 = insertSession.run(event2.lastInsertRowid, 'Modern Web Security & Zero-Trust Auth', '2026-09-20T14:00:00Z', 75, 'Room 204', 30);

  // 4. Seed Staff Assignments
  const insertAssignment = db.prepare(`
    INSERT INTO staff_assignments (user_id, session_id) VALUES (?, ?)
  `);
  insertAssignment.run(staff1Id, s1.lastInsertRowid);
  insertAssignment.run(staff1Id, s2.lastInsertRowid);
  insertAssignment.run(staff2Id, s3.lastInsertRowid);

  // Helper for date string past N days
  const pastDate = (daysAgo, hours = 10) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hours, 0, 0, 0);
    return d.toISOString();
  };

  // 5. Seed Registrations & Timeline History
  const insertReg = db.prepare(`
    INSERT INTO registrations (session_id, attendee_name, attendee_email, status, reserved_at, confirmed_at, checked_in_at, expired_at, cancelled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHist = db.prepare(`
    INSERT INTO registration_history (registration_id, old_status, new_status, actor_id, actor_name, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seedRegistrationWithHistory = (sessionId, name, email, status, daysAgo) => {
    const reservedAt = pastDate(daysAgo, 9);
    let confirmedAt = null;
    let checkedInAt = null;
    let expiredAt = null;
    let cancelledAt = null;

    if (status === 'CONFIRMED' || status === 'CHECKED_IN') {
      confirmedAt = pastDate(daysAgo, 11);
    }
    if (status === 'CHECKED_IN') {
      checkedInAt = pastDate(daysAgo, 14);
    }
    if (status === 'EXPIRED') {
      expiredAt = pastDate(daysAgo, 12);
    }
    if (status === 'CANCELLED') {
      cancelledAt = pastDate(daysAgo, 10);
    }

    const reg = insertReg.run(sessionId, name, email, status, reservedAt, confirmedAt, checkedInAt, expiredAt, cancelledAt);
    const regId = reg.lastInsertRowid;

    // Timeline step 1: Reserved
    insertHist.run(regId, null, 'RESERVED', null, 'System (Self-Service)', 'Initial seat reservation', reservedAt);

    // Timeline step 2: Transition
    if (status === 'CONFIRMED') {
      insertHist.run(regId, 'RESERVED', 'CONFIRMED', organizerId, 'Sarah Jenkins', 'Confirmed registration via admin portal', confirmedAt);
    } else if (status === 'CHECKED_IN') {
      insertHist.run(regId, 'RESERVED', 'CONFIRMED', organizerId, 'Sarah Jenkins', 'Confirmed registration', confirmedAt);
      insertHist.run(regId, 'CONFIRMED', 'CHECKED_IN', staff1Id, 'John Miller', 'Checked in at front desk venue door', checkedInAt);
    } else if (status === 'EXPIRED') {
      insertHist.run(regId, 'RESERVED', 'EXPIRED', null, 'System (Auto-Expiry)', 'Holding window expired (15 min elapsed without confirmation)', expiredAt);
    } else if (status === 'CANCELLED') {
      insertHist.run(regId, 'RESERVED', 'CANCELLED', organizerId, 'Sarah Jenkins', 'User requested cancellation over email', cancelledAt);
    }
  };

  // Populate s2 (Capacity 5) with 5 active registrations to hit 100% capacity
  seedRegistrationWithHistory(s2.lastInsertRowid, 'Alice Vance', 'alice@tech.io', 'CHECKED_IN', 0);
  seedRegistrationWithHistory(s2.lastInsertRowid, 'Bob Smith', 'bob@builder.org', 'CONFIRMED', 0);
  seedRegistrationWithHistory(s2.lastInsertRowid, 'Charlie Davis', 'charlie@devs.net', 'CHECKED_IN', 1);
  seedRegistrationWithHistory(s2.lastInsertRowid, 'Diana Prince', 'diana@hero.com', 'CONFIRMED', 1);
  seedRegistrationWithHistory(s2.lastInsertRowid, 'Ethan Hunt', 'ethan@agent.org', 'RESERVED', 0);

  // Populate s1 with diverse registrations across the last 14 days
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Fiona Apple', 'fiona@music.com', 'CHECKED_IN', 1);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'George Clark', 'george@clark.io', 'CHECKED_IN', 2);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Hannah Abbott', 'hannah@hogwarts.edu', 'CHECKED_IN', 3);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Ian Malcolm', 'ian@dino.org', 'CONFIRMED', 3);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Julia Roberts', 'julia@cinema.com', 'EXPIRED', 4);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Kevin Spacey', 'kevin@test.com', 'CANCELLED', 5);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Laura Croft', 'laura@tomb.org', 'CHECKED_IN', 6);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Michael Scott', 'michael@dunder.com', 'CHECKED_IN', 7);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Nina Williams', 'nina@tekken.jp', 'EXPIRED', 8);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Oscar Martinez', 'oscar@dunder.com', 'CHECKED_IN', 9);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Pam Beesly', 'pam@dunder.com', 'CHECKED_IN', 10);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Quentin Tarantino', 'quentin@cinema.com', 'CHECKED_IN', 11);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Rachel Green', 'rachel@friends.org', 'CHECKED_IN', 12);
  seedRegistrationWithHistory(s1.lastInsertRowid, 'Steve Rogers', 'steve@avengers.org', 'CHECKED_IN', 13);

  // 6. Seed At-Capacity Alert for Session 2
  const insertAlert = db.prepare(`
    INSERT INTO session_alerts (session_id, is_dismissed, capacity_count) VALUES (?, ?, ?)
  `);
  insertAlert.run(s2.lastInsertRowid, 0, 5);

  console.log('Seeding completed successfully!');
  console.log('--- Demo Credentials ---');
  console.log('ORGANIZER: organizer@eventhub.com / password123');
  console.log('CHECKIN_STAFF: staff@eventhub.com / password123');
  console.log('CHECKIN_STAFF: emma@eventhub.com / password123');
}

seed().catch(console.error);
