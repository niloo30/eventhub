# Submission — EventHub

This file details the repository links, live application deployment, demo credentials, technology stack summary, and complete goal checklist for Assignment 12 — Event Registration.

---

## Links

- **GitHub repository:** [https://github.com/niloo30/eventhub.git](https://github.com/niloo30/eventhub.git)
- **Live application:** Deployed locally at `http://localhost:5173` (Frontend) & `http://localhost:5000` (Backend API).

---

## Notes for the Reviewer

- The application is pre-seeded with rich demo data across events, sessions, registrations spanning the last 14 days, staff assignments, timeline audit logs, and at-capacity alerts.
- To start the backend and frontend dev servers:
  - Backend: `cd server && npm install && npm run seed && npm run dev` (Port 5000)
  - Frontend: `cd client && npm install && npm run dev` (Port 5173)

---

## Demo Credentials

| Role | Email | Password | Account Holder Name |
|---|---|---|---|
| **ORGANIZER** | `organizer@eventhub.com` | `password123` | Sarah Jenkins (Organizer) |
| **CHECKIN_STAFF** | `staff@eventhub.com` | `password123` | John Miller (Check-in Staff) |
| **CHECKIN_STAFF** | `emma@eventhub.com` | `password123` | Emma Watson (Check-in Staff) |

---

## Stack Summary

| Layer | What We Used | Why |
|---|---|---|
| **Frontend** | React (Vite) + Tailwind CSS + Lucide Icons + Recharts | Fast rendering, Glassmorphic aesthetics, responsive UI, interactive 14-day check-in visualizations. |
| **Backend** | Node.js + Express REST API | Scalable, clean route architecture, server-enforced role middleware (`ORGANIZER` vs `STAFF`). |
| **Database** | SQLite + `better-sqlite3` | Zero-configuration local execution, synchronous ACID transactions for capacity guards and foreign key integrity. |
| **Authentication**| JWT + bcryptjs | Secure password hashing, stateless session tokens, role claims. |

---

## Goal Checklist

| # | Goal | Status | Implementation & Verification Notes |
|---|---|---|---|
| **1** | **Accounts and roles** | **Done** | Server-enforced middleware (`ORGANIZER` vs `CHECKIN_STAFF`). Check-in staff restricted to assigned sessions. |
| **2** | **Events** | **Done** | Create, edit, archive, and restore events (`is_archived` toggle). Archiving hides without destroying sessions/registrations. |
| **3** | **Sessions inside events** | **Done** | Belong to 1 event, title, start time, duration, room location, and real seat capacity settings. |
| **4** | **Registration lifecycle & rules** | **Done** | `Reserved` -> `Confirmed` -> `Checked In`. Capacity cap check. Automated holding-window expiry worker. Cancel rules guarded. |
| **5** | **Staff Assignment** | **Done** | Organizer staff assignment manager + Check-in staff "My Assigned Sessions" view. |
| **6** | **Finding registrations** | **Done** | Server-side text search (name/email), multi-filters (event, session, status), sorting, and server-side pagination. |
| **7** | **Bulk CSV actions** | **Done** | Bulk import CSV with per-row report (`created`, `duplicate`, `rejected` + reason) & CSV export check-in sheet. |
| **8** | **Dashboard & Analytics** | **Done** | Headline numbers (sessions today, checked-in today, expired this week, at capacity), status/session breakdown, 14-day check-in chart. |
| **9** | **Immutable Audit Log Timeline** | **Done** | Clickable timeline modal showing status change history (old/new status, actor name/role, timestamp, notes). Non-editable/deletable. |
| **10**| **At-capacity alerts** | **Done** | Alert area when session reaches 100% capacity, count badge in nav bar, organizer dismissal, auto-retrigger if capacity refills. |

---

## Time Spent & Reflections

- **Actual Time Spent**: ~15 hours total across 10 structured git commit milestones.
- **Next 12 Hours**: Add QR-code badge scanning via WebRTC camera for instant door check-ins.
- **Codebase Highlights**: Robust state machine guards, atomic SQL transactions preventing race-condition overbooking, and comprehensive documentation.
