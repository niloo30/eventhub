# Architectural Decision Records (ADR) — EventHub

This document logs key design decisions made during the architecture and development of EventHub.

---

## Decision 1: SQLite Database Engine with `better-sqlite3`

- **Context**: The application requires zero-configuration local execution with relational integrity, foreign keys, and atomic transactions.
- **Decision**: Selected SQLite via the synchronous `better-sqlite3` driver for local development and demonstration.
- **Rationale**: `better-sqlite3` executes synchronously without async overhead, guarantees ACID compliance, supports `PRAGMA foreign_keys = ON`, and requires zero external database daemons or configuration.
- **Rejected Alternatives**: PostgreSQL (requires local service setup), MongoDB (lacks native transactional state machine guarantees for seat capacity guards).

---

## Decision 2: Server-Enforced Role Security Boundaries

- **Context**: Requirement 1 states that role differences between Organizers and Check-in Staff must be enforced on the server, not merely hidden in the interface.
- **Decision**: Implemented Express middleware `requireRole('ORGANIZER')` and `checkStaffSessionAccess` on all mutating and querying endpoints.
- **Rationale**: Relying on frontend UI hiding is insecure. Even if a user crafts direct HTTP API requests, the server validates JWT claims and session assignments, returning HTTP 403 Forbidden for unauthorized actions.

---

## Decision 3: Atomic Database Transactions for Capacity Guards & History Logging

- **Context**: When multiple users attempt to reserve seats simultaneously in a popular session, race conditions can cause overbooking. Additionally, every status change requires an immutable timeline log entry.
- **Decision**: Wrapped all seat reservations, status transitions, and bulk CSV imports inside SQLite atomic transactions (`db.transaction()`).
- **Rationale**: Ensures that seat availability check + registration creation + audit history logging happen atomically. If capacity is reached mid-transaction, the transaction rolls back cleanly, preventing room overbooking.

---

## Decision 4: Automated Holding-Window Expiry Background Engine

- **Context**: Requirement 4 specifies that a reservation left `Reserved` longer than a set holding window must automatically transition to `Expired`, freeing the seat.
- **Decision**: Implemented a dual-strategy expiry worker:
  1. A background `setInterval` task running every 60 seconds.
  2. Lazy evaluation triggered before generating registration queries or dashboard stats.
- **Rationale**: Dual evaluation guarantees that stale reservations expire promptly even if background timers drift, while keeping seat availability accurate for incoming users.

---

## Decision 5: REVERSED DECISION — Client-Side Filtering vs. 100% Server-Side Search, Filtering, & Pagination

- **Initial Choice**: Initially considered loading the registration list into client state and applying JavaScript filtering in the React browser component.
- **Reversal Rationale**: Requirement 6 explicitly forbids client-side filtering: *"All of this must happen on the server — do not load every registration into the browser and filter there."*
- **Final Decision**: Built a dedicated SQL query generator in `server/src/routes/registrations.js` supporting `LIKE` search, multi-field `WHERE` clauses, dynamic `ORDER BY`, `LIMIT`, `OFFSET`, and total match count calculations. All search, filtering, and pagination happen 100% on the server.
