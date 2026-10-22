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

---

## Fresh-Clone Setup & Teammate Guide

If you are a teammate cloning this repository on a clean machine, follow these steps to install prerequisites, configure the environment, run automated tests, and launch the application.

### 1. Prerequisites by Operating System

Ensure your system has **Git**, **Node.js (v18+ or v20+)**, **npm**, **Docker & Docker Compose**, and the **PostgreSQL client (`psql`)**.

#### macOS (Homebrew)
```bash
# Install Node.js, Git, and PostgreSQL client
brew install node git libpq

# Make psql available in your PATH (if not already linked)
brew link --force libpq
# Or add to ~/.zshrc: export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# Install and launch Docker Desktop from:
# https://www.docker.com/products/docker-desktop/
# Make sure the Docker engine is running before proceeding!
```

#### Ubuntu / Debian Linux
```bash
sudo apt update
sudo apt install -y git curl nodejs npm postgresql-client docker.io docker-compose-plugin

# Start and enable Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and log back in for docker group permissions to take effect
```

#### Windows (WSL 2 Recommended)
1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) and enable **WSL 2 Integration** in Docker Desktop settings.
2. Open your Ubuntu WSL 2 terminal and run:
```bash
sudo apt update
sudo apt install -y git curl nodejs npm postgresql-client
```

---

### 2. Step-by-Step Setup from Fresh Clone

#### Step 1: Clone the Repository & Enter Workspace
```bash
git clone <repository-url>
cd campus-seats
```

#### Step 2: Configure Environment Files
Copy the template configuration files for root, backend, and frontend:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
*(The default configurations map PostgreSQL to port `5433` and Redis to port `6380` so they never conflict with any locally installed default Postgres or Redis services).*

#### Step 3: Start Database & Redis Services
```bash
docker compose up -d
```
Verify that both containers are running and healthy:
```bash
docker compose ps
```
*Expected: `campus-seats-db-1` (port 5433) and `campus-seats-redis-1` (port 6380) running.*

#### Step 4: Install Dependencies
Run the root setup command (or install backend and frontend separately):
```bash
# One-command install for both backend and frontend:
npm run setup

# Or manually:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

#### Step 5: Initialize Schema & Seed 1,200 Records
Run the automated schema application and seed generator:
```bash
./database/scripts/reset.sh --seed
# Or: npm run db:reset
```
This executes all 6 DDL migrations (extensions, tables, indexes, functions, triggers, views) and executes `generate_seed.js` to create **1,199 production records** across all 15 tables.

---

### 3. Testing & Verification

Before launching the servers, verify that the database constraints and APIs pass 100% of their test suites:

#### A. Backend Integration & Concurrency Tests (Jest)
```bash
npm run test
# Or: cd backend && npm test
```
**Expected:** `6 passed, 6 total` suites, **`64 passed, 64 total`** tests.
Tests auth flows, seat hold expiration, double-booking race conditions, payment verification, and organizer reports.

#### B. Database Rule Violation Tests (SQL)
```bash
npm run test:db
# Or: ./database/tests/run_all.sh
```
**Expected:** `Summary: 5 / 5 tests passed.`

#### C. Live Constraint Enforcement Demo
```bash
npm run test:demo
# Or: ./demo_constraints.sh
```
**Expected:** `ALL 5 / 5 CONSTRAINTS LIVE-VERIFIED & ENFORCED BY DBMS!`
Live demonstration of PostgreSQL error messages for double-booking (BR1), show overlap (BR2), classroom seat rules (BR3), ticket limits (BR6), and duplicate payments (BR15).

---

### 4. Running the Application Locally

Start the backend API and frontend Vite servers in separate terminal tabs:

#### Terminal 1 — Backend API Server
```bash
npm run dev:backend
# Or: cd backend && npm run dev
```
- Server URL: **`http://localhost:3001`**
- Health Check: **`http://localhost:3001/api/v1/health`** (returns `{ "status": "ok", "db": "connected", "redis": "connected" }`)

#### Terminal 2 — Frontend Client (Vite)
```bash
npm run dev:frontend
# Or: cd frontend && npm run dev
```
- Client Application: **`http://localhost:5173`**

Open **`http://localhost:5173`** in your browser.

---

## Demo Credentials & UI Walkthrough

All test accounts use the standard demo password: **`Password123!`**

| Role | Email | Password | Privileges & Key Workflows |
|---|---|---|---|
| **Club Manager** | `manager@seatsync.ac.in` | `Password123!` | Create events, schedule shows (Auditorium & Classroom), set prices, view reports dashboard |
| **Student Attendee** | `student1@seatsync.ac.in` | `Password123!` | Book auditorium seats / classroom passes at student rate; see student-only events |
| **Faculty Attendee** | `faculty@seatsync.ac.in` | `Password123!` | Book tickets at faculty rate; view booking history & cancellations |
| **Guest Attendee** | `guest@seatsync.ac.in` | `Password123!` | General public bookings; restricted from student-only shows |

### Step-by-Step Verification in the Browser:

1. **Test Attendee Exact Seat Booking (Auditorium):**
   - Log in as `student1@seatsync.ac.in` / `Password123!`.
   - On `/events`, click on **"Oasis Cultural Night"** or any auditorium show.
   - Click an available seat on the interactive SVG seat map (e.g., in Row H, I, or J).
   - Notice the selected seat counter and calculated student price.
   - Click **"Proceed to Checkout"**.
   - Notice the **5-minute countdown timer** (synced with Redis TTL).
   - Click **"Confirm & Pay"** (select Credit Card or UPI).
   - Booking transitions to **CONFIRMED**, payment is marked **SUCCESS**, and tickets are displayed on `/my-bookings`.

2. **Test Classroom General Admission Booking:**
   - On `/events`, select a Classroom event (e.g. **"Machine Learning Workshop"** or **"Debate Championship"**).
   - Notice the venue displays **Classroom** with total capacity and live remaining passes.
   - Use the ticket counter to select passes (e.g., 2 passes) without choosing seat numbers.
   - Complete checkout and verify tickets are issued with `row_label: NULL` and `seat_no: NULL` per Rule BR3.

3. **Test Club Manager Show Creation & Audience Restrictions:**
   - Log in as `manager@seatsync.ac.in` / `Password123!`.
   - Click **"Organizer Dashboard"** in the navigation bar.
   - Click **"Schedule Show"**.
   - Try creating a show for **Main Auditorium** or choose **Classroom** and enter a custom room number (e.g. `Room 405`, capacity `50`).
   - Select **Target Audience** = `Student Only`.
   - Submit and verify the show is scheduled.
   - Log out, log in as `guest@seatsync.ac.in`, and verify that the newly created student-only show is automatically hidden from guests.

4. **Test Analytics & Reporting Dashboard:**
   - As `manager@seatsync.ac.in`, navigate to `/dashboard`.
   - Inspect the **Occupancy Rate**, **Gross Revenue**, **Tickets Sold**, and **Active Shows** metric cards.
   - Filter by specific events and review the attendee tier breakdown (Student vs Faculty vs Guest) calculated by PostgreSQL views.

5. **Test Cancellations & Refunds:**
   - Under **"My Bookings"** (`/my-bookings`), find a confirmed booking and click **"Cancel Booking"**.
   - Confirm cancellation: booking status changes to `CANCELLED`, tickets are freed, and refund record is created.

---

## Troubleshooting Guide for Teammates

### 1. `psql: command not found`
- **macOS:** Run `brew install libpq && brew link --force libpq`. If it still isn't recognized, add `/opt/homebrew/opt/libpq/bin` to your `PATH` in `~/.zshrc`.
- **Linux / WSL 2:** Run `sudo apt update && sudo apt install -y postgresql-client`.

### 2. `Error: connect ECONNREFUSED 127.0.0.1:5433`
- PostgreSQL is not running on port 5433.
- Verify Docker is running: `docker compose ps`.
- If containers stopped, start them: `docker compose up -d`.

### 3. `Port 5433 or 6380 already allocated`
- Another process is using port 5433 or 6380.
- Check what process is using the port: `lsof -i :5433` or `lsof -i :6380`.
- Alternatively, adjust `POSTGRES_PORT` or `REDIS_PORT` in your root `.env` and `backend/.env`.

### 4. `Permission denied: ./demo_constraints.sh`
- Grant executable permissions to all shell scripts:
```bash
chmod +x demo_constraints.sh database/scripts/*.sh database/tests/*.sh
```

### 5. `Vite Frontend cannot connect to Backend API`
- Verify backend is running on `http://localhost:3001` by visiting `http://localhost:3001/api/v1/health`.
- Check `frontend/.env`: ensure `VITE_API_URL=http://localhost:3001/api/v1`.

---

## Repository Structure

```
.
├── docker-compose.yml             # PostgreSQL 15 (5433) & Redis (6380)
├── demo_constraints.sh            # Live DBMS constraint enforcement demonstration
├── package.json                   # Root workspace helper scripts
├── .env.example                   # Environment configuration template
├── docs/
│   ├── Database_Design_Document.pdf
│   ├── Application_Design.pdf
│   ├── architecture/              # Diagrams (ER, EER, schema, sequences)
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


