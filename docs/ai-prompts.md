# AI Prompt Log & System Instructions — EventHub

This document records the prompt workflows, design discussions, and prompt iteration logs used during the development of EventHub.

---

## 1. Initial Prompt & System Requirements Analysis

**Objective**: Understand the 10 core requirements, evaluation criteria, and documentation obligations of Assignment 12 — Event Registration.

**Prompts Used**:
- *"Read the assignment README.md and summarize all 10 core requirements, time budget, and documentation deliverables."*
- *"Analyze the project guidelines and confirm whether incremental git commits are required."*

**Outcome**: Confirmed all 10 core requirements (Role-enforced accounts, Events, Sessions with capacity, Registration state machine with auto-expiry, Staff assignments, Server-side search/pagination, CSV bulk import/export, Dashboard analytics, Immutable timeline, At-capacity alerts) and established an incremental 10-commit Git roadmap.

---

## 2. Architecture & Stack Alignment Prompts

**Objective**: Select a clean, modern, production-grade tech stack matching developer skills.

**Prompts Used**:
- *"What tech stack options fit MERN and SQL experience while providing zero-config local running and seamless deployment compatibility?"*
- *"Propose a 4-layer production folder structure separating server routes, domain services, database schemas, and React components."*

**Outcome**: Selected Node.js + Express + SQLite (`better-sqlite3`) + React (Vite) + Tailwind CSS + Lucide Icons.

---

## 3. Iteration & Correction Log (Prompt Refinement Example)

### Initial Prompt (Produced Incomplete Logic):
- *"Write an Express route for registration state transitions."*

### Issues Identified:
- The initial code did not enforce the restriction that `CHECKED_IN` registrations cannot be cancelled.
- It did not verify that Check-in Staff members can only mutate registrations for sessions assigned to them.
- It omitted recording the immutable audit history entry.

### Corrective Iteration Prompt:
- *"Update the registration status transition endpoint to strictly enforce: 1) Checked In registrations cannot be cancelled, 2) Check-in Staff are restricted to assigned sessions, and 3) All transitions must atomically append a record to `registration_history` capturing old status, new status, actor name/role, timestamp, and notes."*

### Resulting Output:
- Produced the complete, secure `PATCH /api/registrations/:id/status` endpoint in `server/src/routes/registrations.js` with full role guards and atomic transaction history logging.
