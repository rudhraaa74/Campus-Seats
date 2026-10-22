# SeatSync — Campus Venue Booking System

DBMS Course Project · Full-stack Database Application · Final Submission

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Postman](https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white)](https://www.postman.com/)

> **Status: Complete & Production-Ready.** All 7 project phases fully implemented, tested, and verified. 
> Includes a **1,199-record seed dataset** across 15 relations, 100% green automated test suites (64/64 Jest API & concurrency tests, 5/5 database constraint tests), and a live constraint enforcement demonstration.

---

## Table of Contents
- [About SeatSync](#about-seatsync)
- [Team Members & Contributions](#team-members--contributions)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Database Design & Integrity Constraints](#database-design--integrity-constraints)
- [End-to-End Workflows (W1–W5)](#end-to-end-workflows-w1w5)
- [Quick Start Guide](#quick-start-guide)
- [Demo Credentials](#demo-credentials)
- [Testing & Verification](#testing--verification)
- [Live Constraint Enforcement Demo](#live-constraint-enforcement-demo)
- [Repository Structure](#repository-structure)

---

## About SeatSync

Campus events (music concerts, cultural fests, theatre plays, hackathons, academic lectures, stand-up comedy) are held across auditoriums and classrooms. Traditional campus ticketing frequently suffers from over-selling, lack of reserved seating, manual price tiering, and zero visibility into attendance or revenue.

**SeatSync** solves this with a robust full-stack database application:
- **Exact Seat Booking:** Interactive SVG seat map for the 500-seat Main Auditorium (Balcony & Stalls, Silver & Gold tiers).
- **General Admission:** Capacity-managed classroom venues (e.g., LT-1, LT-2, LT-3) with real-time remaining seat counters.
- **Fair Subsidised Pricing:** Multi-tiered pricing structure automatically applying campus discounts for students and faculty.
- **Concurrency & Double-Booking Protection:** Strict DBMS-level partial unique indexes and Redis TTL hold timers (5 minutes).
- **Organizer Self-Service & Analytics:** Club managers schedule shows, manage price grids, restrict audience eligibility (e.g., Student-Only), and inspect occupancy and revenue dashboards.

---

## Team Members & Contributions

**Lab Session:** P1, Group-2

| Name | ID | Design Document Contribution | Implementation Responsibilities |
|---|---|---|---|
| **Areesha Shahid** | 2023B1A40991H | Requirements, business rules (BR1–BR15), ER diagram | **Workflow 1 (Auth & Profiles)** and **Workflow 3 (Cancellations & Refunds)**; integration tests for auth and cancellations. |
| **Harshitha Ambavarapu** | 2023B2AD0873H | EER diagram (weak entities, `USER` specialization), relational mapping | **Workflow 4 (Organizer Setup)**; classroom dynamic venue registration; audience restriction enforcement (`allowed_attendees`). |
| **Rudhra Koul** | 2023B3AD0445H | Relational schema, composite foreign keys, constraint design | **Workflow 2 (Hold, Pay, Confirm)**; concurrency safety, row locking (`FOR UPDATE`), Redis TTL lifecycle, Jest test suite. |
| **Geetanjali Dangeti Sree** | 2023B4AD0609H | Design justification, application architecture, tech stack selection | **Front-End Client (React + Tailwind CSS)**; interactive seat map, checkout with live hold timer, attendee filtering. |
| **Pranay Pratyush** | 2023B5AA1211H | Workflow design, sequence diagrams, Git repository management | **Workflow 5 (Reports & Analytics Dashboard)**; 1,200-record seed generator; live constraint demo script (`demo_constraints.sh`). |

---

## Tech Stack & Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │         Client: React 18 + Tailwind CSS (Vite)          │
  │     (Interactive Seat Map, Live Timer, Reports UI)     │
  └───────────────────────────┬────────────────────────────┘
                              │ HTTPS / JSON API
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │             Backend: Node.js 18 + Express              │
  │        (JWT Auth, Transactions, Parameterized SQL)     │
  └───────────────┬────────────────────────┬───────────────┘
                  │                        │
       SET / DEL / TTL (300s)       pg Pool (BEGIN/COMMIT)
                  │                        │
                  ▼                        ▼
  ┌────────────────────────┐   ┌───────────────────────────┐
  │      Redis Cache       │   │   PostgreSQL 15 Database  │
  │   (Hold Countdown)     │   │ (Constraints, Triggers,   │
  │                        │   │  GiST Range, Views)       │
  └────────────────────────┘   └───────────────────────────┘
```

- **PostgreSQL 15** is the single source of truth. All core business rules, price calculations, ticket limits, and concurrency invariants are enforced inside the database engine via constraints and triggers.
- **Redis (key TTL 300s)** acts as a lightweight fast countdown cache. If Redis restarts, PostgreSQL triggers and the safety net scheduler (`expire_holds()`) ensure zero data corruption or double booking.
- **node-postgres (`pg`)** uses explicit transaction boundaries (`BEGIN` / `COMMIT` / `ROLLBACK`) and strict parameterized queries to prevent SQL injection.

---

## Database Design & Integrity Constraints

SeatSync models **15 relational tables**:
`users`, `student`, `faculty`, `guest`, `club`, `club_manager`, `venue`, `seat_category`, `seat`, `event`, `show`, `show_price`, `booking`, `ticket`, `payment`.

### Key Enforced DBMS Business Rules
1. **Rule BR1 (No Double Booking):** Enforced via partial `UNIQUE` index `uq_ticket_live_seat` on `ticket(show_id, venue_id, row_label, seat_no) WHERE status IN ('HELD', 'ACTIVE')`.
2. **Rule BR2 (No Overlapping Shows in a Venue):** Enforced via GiST exclusion constraint `ex_show_venue_overlap` using `tsrange(start_time, end_time, '[)') WITH =` on `show`.
3. **Rule BR3 (Classroom Seat Coordinates Restriction):** Enforced via CHECK constraint `ck_ticket_classroom_null_seat` ensuring `row_label` and `seat_no` are `NULL` for General Admission venues.
4. **Rule BR6 (Ticket Limits):** BEFORE INSERT/UPDATE trigger `fn_check_ticket_limits()` rejecting any booking attempt with > 6 live tickets.
5. **Rule BR7 (Subsidised Pricing):** Trigger `fn_check_subsidised_pricing()` guarantees student price $\le$ faculty price $\le$ guest price.
6. **Rule BR11 (Club Manager Scoping):** Club managers can only create and modify events/shows for clubs they explicitly administer.
7. **Rule BR14 (Booking Window):** Shows cannot be booked once they have started or after cancellation.
8. **Rule BR15 (Single Successful Payment):** Partial `UNIQUE` index `uq_payment_one_success` on `payment(booking_id) WHERE status = 'SUCCESS'`.

---

## End-to-End Workflows (W1–W5)

### Workflow 1: Registration & Authentication
- **Action:** User registers as Student, Faculty, or Guest with role-specific attributes (roll number, employee ID, affiliation).
- **DBMS Implementation:** Atomic transaction inserting into `users` and the corresponding specialization table (`student`, `faculty`, `guest`).
- **Endpoints:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.

### Workflow 2: Hold, Pay, Confirm (The Reservation Core)
- **Action:** Attendee selects seats or specifies general-admission pass quantity.
- **DBMS Implementation:**
  1. Transaction begins; seats are locked using `FOR UPDATE`.
  2. Booking row created with `status = 'PENDING'` and `hold_expires_at = CURRENT_TIMESTAMP + 5 minutes`.
  3. Ticket rows inserted with `status = 'HELD'`.
  4. Trigger `fn_calculate_booking_total` sums ticket prices into `booking.total_amount`.
  5. 300-second TTL key set in Redis (`hold:<booking_id>`).
  6. Upon payment (`POST /bookings/:id/pay`), booking becomes `CONFIRMED`, payment row recorded as `SUCCESS`, tickets transition to `ACTIVE`, and Redis key is cleared.
- **Endpoints:** `POST /api/v1/bookings`, `POST /api/v1/bookings/:id/pay`.

### Workflow 3: Booking Cancellation & Refunds
- **Action:** Attendee cancels an existing reservation.
- **DBMS Implementation:** Transaction updates `booking.status = 'CANCELLED'`, cascades ticket statuses to `CANCELLED`, and inserts a `REFUNDED` payment audit record.
- **Endpoints:** `DELETE /api/v1/bookings/:id`, `GET /api/v1/bookings/mine`.

### Workflow 4: Organizer Show Setup & Pricing
- **Action:** Club manager schedules a show, selects an auditorium or registers a classroom with custom capacity, sets audience restriction (`STUDENT_ONLY`, `FACULTY_ONLY`, `ALL`), and defines the price matrix.
- **DBMS Implementation:**
  1. Verifies manager club authorization (`club_manager` relation).
  2. Inserts show; GiST index detects and rejects any venue scheduling conflicts.
  3. Inserts price matrix into `show_price`; trigger verifies subsidy inequality rules.
- **Endpoints:** `POST /api/v1/organizer/shows`, `POST /api/v1/organizer/venues/classroom`, `PUT /api/v1/organizer/shows/:id/prices`.

### Workflow 5: Analytics & Reporting Dashboard
- **Action:** Club managers view real-time occupancy and revenue breakdowns.
- **DBMS Implementation:** Non-trivial SQL queries with aggregations, `GROUP BY`, `HAVING`, and window functions leveraging views `v_show_occupancy` and `v_event_revenue`.
- **Endpoints:** `GET /api/v1/reports/occupancy`, `GET /api/v1/reports/revenue`, `GET /api/v1/reports/top-events`.

---

## Quick Start Guide

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ & npm
- PostgreSQL client (`psql`)

### 1. Start Infrastructure Services
```bash
cp .env.example .env
docker compose up -d
```
*PostgreSQL runs on port `5433` and Redis runs on port `6380` (configured to avoid conflicts with default system services).*

### 2. Initialize Database & Generate 1,200-Record Dataset
Run the one-command database reset and seed generator:
```bash
./database/scripts/reset.sh --seed
```
This drops the database, applies all extensions, tables, indexes, triggers, and views in order, and generates **1,199 records** across all 15 relations:
- 500 physical auditorium seats
- 64 users (41 students, 12 faculty, 11 guests)
- 8 campus events & 5 campus clubs
- 14 shows scheduled across 4 venues
- 125 bookings, 235 tickets, and 119 payments

### 3. Start Backend API Server
```bash
cd backend
npm install
npm run dev
```
*API server starts at `http://localhost:3001`.*

### 4. Start Front-End Client
```bash
cd frontend
npm install
npm run dev
```
*Vite client starts at `http://localhost:5173`.*

---

## Demo Credentials

All seeded demo accounts use the standard password: `Password123!`

| Role | Email | Club / Specialization | Access Privileges |
|---|---|---|---|
| **Club Manager** | `manager@seatsync.ac.in` | Music Society (Admin) | Organizer show setup, classroom creator, analytics dashboard |
| **Student Attendee** | `student1@seatsync.ac.in` | 3rd Year CS Student | Student-subsidised tickets, student-only shows, booking history |
| **Faculty Attendee** | `faculty@seatsync.ac.in` | CS Department Faculty | Faculty rate tickets, faculty-eligible shows |
| **Guest Attendee** | `guest@seatsync.ac.in` | Campus Alumni Network | General public / guest pricing shows |

---

## Testing & Verification

### Automated Backend Tests (Jest)
Run all API integration and concurrency tests:
```bash
cd backend
npm test
```
**Results:** `6 passed, 6 total` suites; **`64 passed, 64 total`** tests.
- `auth.test.js`: Registration, login, profile retrieval, invalid credentials.
- `browse.test.js`: Event catalog, venue filtering, seat availability maps.
- `bookings.test.js`: Seat holds, 5-min Redis TTL, simulated payments, expired holds, ticket limit rejections.
- `organizer.test.js`: Event creation, show scheduling, classroom setup, price configuration, show cancellation.
- `reports.test.js`: Occupancy, revenue breakdown, top events aggregation.
- `double-booking.test.js`: Concurrent race condition test validating partial unique index and row locking.

### Database Integrity Tests (SQL)
Run all standalone PostgreSQL rule violation tests:
```bash
./database/tests/run_all.sh
```
**Results:** `5 / 5 tests passed.`

---

## Live Constraint Enforcement Demo

To witness live database-level constraint rejections with descriptive PostgreSQL error messages, run the interactive demonstration script:
```bash
./demo_constraints.sh
```

**Demonstrated Rejections:**
1. **Rule BR1 (Double Booking):** Rejection of duplicate live ticket insertion via `uq_ticket_live_seat`.
   `ERROR: duplicate key value violates unique constraint "uq_ticket_live_seat"`
2. **Rule BR2 (Show Overlap):** Rejection of overlapping show booking in Main Auditorium via `ex_show_venue_overlap`.
   `ERROR: conflicting key value violates exclusion constraint "ex_show_venue_overlap"`
3. **Rule BR3 (Classroom Seat Coordinates):** Rejection of physical seat numbers for classroom venues via `ck_ticket_classroom_null_seat`.
   `ERROR: Could not determine seat category for ticket.`
4. **Rule BR6 (Ticket Limits):** Rejection of 7th ticket insertion into a single reservation via `fn_check_ticket_limits()`.
   `ERROR: A booking cannot contain more than 6 live tickets.`
5. **Rule BR15 (Duplicate Successful Payment):** Rejection of secondary payment via `uq_payment_one_success`.
   `ERROR: duplicate key value violates unique constraint "uq_payment_one_success"`

---

## Repository Structure

```
.
├── docker-compose.yml             # PostgreSQL 15 (5433) & Redis (6380)
├── demo_constraints.sh            # Live DBMS constraint enforcement demonstration
├── .env.example                   # Environment configuration template
├── docs/
│   ├── Database_Design_Document.pdf
│   ├── Application_Design.pdf
│   └── api/
│       ├── API.md                 # Complete REST API specification
│       └── postman_collection.json # Exported Postman collection
├── database/                      # SQL scripts, seed data, and tests
│   ├── schema/                    # 01_extensions -> 06_views
│   ├── seed/
│   │   ├── 01_reference.sql       # Reference venues & categories
│   │   ├── 02_demo.sql            # Base clubs & shows
│   │   └── generate_seed.js       # 1,200-record production seed generator
│   ├── queries/                   # Non-trivial analytics & reports SQL
│   ├── tests/                     # Database rule tests (run_all.sh)
│   └── scripts/                   # reset.sh, apply.sh, demo_constraints.sh
├── backend/                       # Node.js + Express API
│   ├── src/
│   │   ├── modules/               # auth, bookings, browse, organizer, reports
│   │   ├── db/                    # pg connection pool & query helpers
│   │   └── redis/                 # Redis client & hold key manager
│   └── tests/                     # Jest API & concurrency test suites
├── frontend/                      # React 18 + Tailwind CSS (Vite)
│   └── src/
│       ├── components/            # SeatGrid, CountdownTimer, ReportCharts
│       └── pages/                 # Events, ShowDetail, Checkout, Dashboard
└── PLAN.md                        # Master implementation roadmap
```

