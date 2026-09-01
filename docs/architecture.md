# Architecture Overview — EventHub

## 1. System Topology & Moving Pieces

EventHub is structured as a full-stack, modular web application following a clean **4-Layer Architecture**:

```text
[ React (Vite) + Tailwind CSS ]  <--- HTTP/JSON REST API --->  [ Node.js + Express API Server ]
        (Browser UI)                                                  (Server Logic & Auth)
                                                                               |
                                                                               v
                                                                    [ SQLite3 Database ]
                                                                   (ACID Storage & Foreign Keys)
```

1. **Frontend Layer (`client/`)**: Built with React (Vite), Tailwind CSS, Lucide Icons, and Recharts. Runs in the user's browser, managing UI state, JWT token storage, client-side routing, interactive modals, and real-time alert polling.
2. **Security & API Layer (`server/src/routes/` & `server/src/middleware/`)**: Node.js & Express REST API handlers guarded by `authenticateToken` and `requireRole('ORGANIZER' | 'CHECKIN_STAFF')`. Role boundaries are strictly enforced on the server.
3. **Business Logic Layer (`server/src/services/`)**: 
   - `registrationService`: Manages state machine rules (`Reserved` -> `Confirmed` -> `Checked In`) and seat capacity limits.
   - `expiryService`: Automated holding-window background worker auto-expiring stale `RESERVED` registrations.
   - `alertService`: Calculates 100% capacity triggers, alert dismissals, and re-triggering logic.
4. **Data Access & Storage Layer (`server/src/db/`)**: SQLite database (`eventhub.db`) using `better-sqlite3` with foreign keys enabled (`PRAGMA foreign_keys = ON`) and atomic SQL transactions.

---

## 2. Request Path: Representative User Action End-to-End

### Scenario: An Attendee Reserving a Seat in a Session

1. **Client Trigger**: The user submits the "Create Seat Reservation" modal in React with `session_id`, `attendee_name`, and `attendee_email`.
2. **HTTP Dispatch**: React sends a `POST /api/registrations` request with `Authorization: Bearer <jwt_token>`.
3. **Auth & Role Middleware**: `authenticateToken` verifies the JWT signature and extracts user context (`id`, `name`, `role`). If the user is `CHECKIN_STAFF`, `checkStaffSessionAccess` verifies they are assigned to `session_id`.
4. **Capacity Guard**: The server queries active seats (`RESERVED + CONFIRMED + CHECKED_IN`). If `active_count >= capacity`, the request is immediately rejected with HTTP 400 and a human-readable error explaining that the room is full.
5. **Atomic Transaction**:
   - `INSERT INTO registrations` with status `RESERVED`.
   - `INSERT INTO registration_history` capturing `old_status: NULL`, `new_status: RESERVED`, `actor_id`, `actor_name`, timestamp, and notes.
6. **Alert Engine Check**: `evaluateSessionAlert(session_id)` computes whether active seats now equal or exceed 100% capacity. If full, a `session_alerts` record is created/re-triggered.
7. **Client Response**: Returns HTTP 201 with the created registration object. The React UI updates state and displays a success notification.

---

## 3. What We Decided NOT to Build (Deliberate Scope Boundaries)

- **Public Self-Service Payment Gateways**: Kept ticket reservation focused on seat allocation and holding-window lifecycle without external payment vendor dependencies.
- **Multi-Tenant Database Isolation**: Designed for a single conference organization operating multiple events per year rather than multi-tenant SaaS isolation.
- **Client-Side Data Filtering**: Rejected loading all registrations into the browser; all search, filtering, sorting, and pagination are executed 100% on the server.
