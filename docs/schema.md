# Database Schema Documentation — EventHub

## 1. Tables & Schema Definition

### `users`
- `id` (INTEGER, Primary Key, Auto-increment)
- `email` (TEXT, Unique, Not Null)
- `password_hash` (TEXT, Not Null)
- `name` (TEXT, Not Null)
- `role` (TEXT, Not Null, CHECK `role IN ('ORGANIZER', 'CHECKIN_STAFF')`)
- `created_at` (DATETIME, Default `CURRENT_TIMESTAMP`)

### `events`
- `id` (INTEGER, Primary Key, Auto-increment)
- `name` (TEXT, Not Null)
- `description` (TEXT)
- `start_date` (TEXT, Not Null)
- `end_date` (TEXT, Not Null)
- `venue` (TEXT, Not Null)
- `is_archived` (INTEGER, Default `0`)
- `created_at`, `updated_at` (DATETIME)

### `sessions`
- `id` (INTEGER, Primary Key, Auto-increment)
- `event_id` (INTEGER, Foreign Key -> `events.id` ON DELETE CASCADE)
- `title` (TEXT, Not Null)
- `start_time` (TEXT, Not Null)
- `duration_mins` (INTEGER, Not Null)
- `location` (TEXT, Not Null)
- `capacity` (INTEGER, Not Null, CHECK `capacity > 0`)
- `created_at`, `updated_at` (DATETIME)

### `staff_assignments`
- `id` (INTEGER, Primary Key, Auto-increment)
- `user_id` (INTEGER, Foreign Key -> `users.id` ON DELETE CASCADE)
- `session_id` (INTEGER, Foreign Key -> `sessions.id` ON DELETE CASCADE)
- `created_at` (DATETIME)
- UNIQUE Constraint: `(user_id, session_id)`

### `registrations`
- `id` (INTEGER, Primary Key, Auto-increment)
- `session_id` (INTEGER, Foreign Key -> `sessions.id` ON DELETE CASCADE)
- `attendee_name` (TEXT, Not Null)
- `attendee_email` (TEXT, Not Null)
- `status` (TEXT, CHECK `status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'EXPIRED', 'CANCELLED')`)
- `reserved_at`, `confirmed_at`, `checked_in_at`, `expired_at`, `cancelled_at` (DATETIME)

### `registration_history` (Immutable Audit Log)
- `id` (INTEGER, Primary Key, Auto-increment)
- `registration_id` (INTEGER, Foreign Key -> `registrations.id` ON DELETE CASCADE)
- `old_status` (TEXT)
- `new_status` (TEXT, Not Null)
- `actor_id` (INTEGER, Foreign Key -> `users.id` ON DELETE SET NULL)
- `actor_name` (TEXT, Not Null)
- `notes` (TEXT)
- `created_at` (DATETIME)

### `session_alerts` (At-Capacity Alerts)
- `id` (INTEGER, Primary Key, Auto-increment)
- `session_id` (INTEGER, Foreign Key -> `sessions.id` ON DELETE CASCADE)
- `is_dismissed` (INTEGER, Default `0`)
- `capacity_count` (INTEGER, Not Null)
- `created_at`, `updated_at` (DATETIME)

---

## 2. Relationships

- **Event -> Sessions**: One-to-Many (`events.id` -> `sessions.event_id`)
- **Session -> Registrations**: One-to-Many (`sessions.id` -> `registrations.session_id`)
- **Registration -> Registration History**: One-to-Many (`registrations.id` -> `registration_history.registration_id`)
- **Users <-> Sessions (Staff Assignments)**: Many-to-Many via junction table `staff_assignments`.

---

## 3. Database vs Application Constraints

- **Database Constraints**: Primary keys, Foreign key cascades, UNIQUE constraints on `(user_id, session_id)` and `users.email`, CHECK constraints on `role`, `status`, and `capacity > 0`.
- **Application Constraints**:
  - Capacity calculation guard (`active_count < capacity`).
  - State machine transition rules (preventing cancellation of checked-in attendees).
  - Role-based session access permissions for check-in staff.

---

## 4. Deliberate Denormalization

- `registration_history.actor_name`: Stored directly so audit timeline logs retain the actor's historical display name even if user accounts are modified or deleted later.
- `session_alerts.capacity_count`: Denormalized on alert records to track the snapshot of active capacity when the alert was triggered.

---

## 5. Scalability Analysis: What Would Break First at 100x Data Scale?

1. **SQLite Database Locking**: SQLite uses file-level locking for writes. At 100x traffic (thousands of concurrent check-ins per second at a venue door), write lock contention would cause latency spikes.
   - *Fix*: Migrate database connection from SQLite to PostgreSQL (e.g. Supabase / AWS RDS) using connection pooling (PgBouncer).
2. **Sequential Background Expiry Scanning**: `checkAndExpireReservations()` currently queries `registrations` periodically. At 100x scale, scanning millions of rows would require an index on `(status, reserved_at)` or an asynchronous task queue (Redis / BullMQ).
