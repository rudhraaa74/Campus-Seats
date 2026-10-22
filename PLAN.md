# SeatSync — Build Plan

How we go from the finished design (mid-sem) to a working full-stack application (final submission **15 Nov**, demo **17–19 Nov**).

Read this once, then use it as a checklist. Tick boxes in pull requests as work lands.

---

## 1. Ground rules

1. **The database is the source of truth.** Business rules live in PostgreSQL (constraints, indexes, triggers). The backend starts transactions and translates errors; the front end only displays. Redis is only a hold timer.
2. **Build in vertical slices.** One workflow at a time, from SQL to screen, and each slice must work in the browser before the next starts.
3. **Layout first (Phase 0).** Everyone agrees where each kind of file goes before anyone writes feature code.
4. **Contract first.** Endpoints and JSON shapes are written in `docs/api/API.md` before backend and front end are built, so both sides can work in parallel.
5. **Every member commits.** Small branches and pull requests; each PR is reviewed by someone else. This also gives clear contribution history for the evaluators.
6. **Everyone can explain everything.** Each workflow owner walks the rest of the team through their SQL before the phase closes.

---

## 2. What we take from the reference repo

Reference: [Rathish200/Tickets](https://github.com/Rathish200/Tickets) (a movie-ticket backend with Redis seat locks).

| We borrow | Why it helps us |
|---|---|
| One folder per feature in the backend (`auth/`, `bookings/`, `payments/`, `admin/`, `search/`), each with route, controller and service files | Easy to find code; each person owns whole modules without merge conflicts |
| Separate `db/` area with schema, init and seed scripts | Matches the course's "database scripts" deliverable |
| `middlewares/`, `utils/`, `redis/`, `types/` folders and a single versioned router (`/api/v1`) | Clear place for shared code |
| `docker-compose.yml` with Postgres and Redis health checks; non-default host ports (5433, 6380) so local installs do not clash | One command to get a working environment |
| `.env.example` for each part, `.gitignore`, `.dockerignore` | No secrets in git, quick onboarding |
| `tests/` folder with API tests (Jest + Supertest) | Repeatable proof that workflows work |
| `architectures/` folder for diagrams and a Postman collection | Good for README, demo and viva |
| README with an API reference table | Evaluators can see every endpoint at a glance |

| We deliberately do not copy | Reason |
|---|---|
| Redis locks as the way to prevent double booking | Our design uses a partial unique index in PostgreSQL; Redis is only a timer |
| BullMQ queues, Razorpay, AWS EC2 and Nginx | Out of scope for a DBMS project (we use a simulated payment gateway) |
| TypeScript | Optional. We use plain JavaScript (ES modules) to keep the focus on SQL; switch only if the whole team prefers TypeScript |
| SQL inside `backend/src/db/` | Our SQL lives in a top-level `database/` folder because the database is the core of the project |
| WebSockets for live seats | Stretch goal only (see Phase 7 stretch list); polling is enough for the demo |

The reference repo has no front end; ours adds `frontend/`.

---

## 3. Target repository layout

Phase 0 creates exactly this structure (empty folders get a `.gitkeep`).

```
seatsync/
├── README.md                      # project overview, team, setup, workflows
├── PLAN.md                        # this file
├── docker-compose.yml             # PostgreSQL + Redis (health-checked)
├── .env.example                   # DB_*/REDIS_* values used by docker-compose
├── .gitignore
│
├── docs/
│   ├── Database_Design_Document.pdf
│   ├── Application_Design.pdf
│   ├── architecture/              # ER, EER, schema, sequence diagrams (PNG/SVG)
│   └── api/
│       ├── API.md                 # endpoint contract (written in Phase 0, kept up to date)
│       └── postman_collection.json
│
├── database/                      # ALL SQL lives here
│   ├── README.md
│   ├── schema/                    # run in numeric order
│   │   ├── 01_extensions.sql      # btree_gist
│   │   ├── 02_tables.sql          # 15 tables, PK/FK/UNIQUE/NOT NULL/CHECK
│   │   ├── 03_indexes.sql         # partial unique indexes, EXCLUDE, search indexes
│   │   ├── 04_functions.sql       # expire_holds(), helper functions
│   │   ├── 05_triggers.sql        # BR rules as triggers
│   │   └── 06_views.sql           # v_venue_capacity + reporting views
│   ├── seed/
│   │   ├── 01_reference.sql       # venues, seats, categories, clubs, club managers
│   │   ├── 02_demo.sql            # small hand-written dataset for development
│   │   └── generate_seed.js       # generator for the 500+ record demo dataset
│   ├── queries/
│   │   └── reports.sql            # the 5+ non-trivial queries used by the dashboard
│   ├── tests/                     # one SQL file per rule: tries to break it, expects an error
│   │   ├── br01_double_booking.sql
│   │   ├── br02_show_overlap.sql
│   │   └── ...
│   └── scripts/
│       ├── apply.sh               # run schema (and optional seed) in order
│       └── reset.sh               # drop, recreate, apply, seed
│
├── backend/
│   ├── README.md
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js               # starts the server and cron job
│   │   ├── app.js                 # Express app, middleware, routes
│   │   ├── config/
│   │   │   └── env.js             # reads and validates environment variables
│   │   ├── db/
│   │   │   ├── pool.js            # pg connection pool
│   │   │   ├── transaction.js     # withTransaction(fn): BEGIN / COMMIT / ROLLBACK
│   │   │   └── errors.js          # maps PostgreSQL error codes to API errors
│   │   ├── redis/
│   │   │   ├── client.js
│   │   │   └── holds.js           # setHold / clearHold / expiry listener
│   │   ├── jobs/
│   │   │   └── expireHolds.js     # node-cron: calls expire_holds() every 30 s
│   │   ├── middleware/
│   │   │   ├── auth.js            # verifies JWT
│   │   │   ├── requireRole.js
│   │   │   ├── requireClubManager.js   # BR11
│   │   │   ├── validate.js        # request body checks
│   │   │   └── errorHandler.js
│   │   ├── modules/               # one folder per feature (like the reference repo)
│   │   │   ├── auth/              # register, login        (W1)
│   │   │   ├── events/            # list, search, detail
│   │   │   ├── shows/             # show detail, seat availability
│   │   │   ├── bookings/          # hold, pay, cancel      (W2, W3)
│   │   │   ├── payments/          # simulated gateway
│   │   │   ├── organizer/         # events, shows, prices  (W4)
│   │   │   └── reports/           # dashboard queries      (W5)
│   │   ├── routes/
│   │   │   └── v1.js              # mounts every module under /api/v1
│   │   └── utils/
│   └── tests/
│       ├── api/                   # Jest + Supertest, one file per module
│       └── concurrency/
│           └── double-booking.js  # N parallel holds on one seat: exactly one wins
│
└── frontend/
    ├── README.md
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── .env.example               # VITE_API_URL
    └── src/
        ├── main.jsx
        ├── App.jsx                # routes
        ├── api/                   # client.js (attaches JWT) + one file per module
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/
        │   └── useCountdown.js
        ├── pages/                 # one file per screen
        │   ├── Login.jsx, Register.jsx
        │   ├── Events.jsx, ShowDetail.jsx
        │   ├── Checkout.jsx, MyBookings.jsx
        │   └── organizer/         # EventForm, ShowForm, PriceGrid, Dashboard
        ├── components/            # SeatMap, CountdownTimer, PriceTable, ReportCharts, ProtectedRoute
        └── utils/
```

### Each module in `backend/src/modules/<name>/`

```
<name>.routes.js        # URL → controller, plus middleware (auth, validation)
<name>.controller.js    # reads the request, calls the service, sends the response
<name>.service.js       # business flow: transactions, calling queries, Redis
<name>.queries.js       # the SQL strings, kept in one place so they are easy to find in the viva
```

### Where does this go?

| If it is… | Put it in… |
|---|---|
| A rule about the data (must always hold) | `database/` (constraint, index or trigger) |
| A multi-step operation (hold, pay, cancel) | the module's `*.service.js`, inside `withTransaction` |
| A SQL statement | the module's `*.queries.js` |
| Turning a database error into a message | `backend/src/db/errors.js` |
| What the user sees | `frontend/src/pages` and `components` |
| A diagram or PDF | `docs/` |

---

## 4. Conventions

**Git**
- Branch from `main`: `feat/<phase>-<short-name>`, for example `feat/p4-hold-endpoint`.
- Commit messages: `feat(bookings): create hold in one transaction`. Prefixes: `feat`, `fix`, `docs`, `test`, `chore`.
- Every merge to `main` goes through a pull request with at least one reviewer who is not the author.
- Never commit `.env`; only `.env.example`.

**SQL**
- Files are numbered so the run order is obvious.
- **Name every constraint and index** (`uq_ticket_live_seat`, `ex_show_venue_overlap`, `uq_payment_one_success`, `ck_venue_capacity`…). The backend picks the user message from the constraint name.
- Triggers raise errors with a clear message and `RAISE EXCEPTION ... USING ERRCODE = 'P0001'` (or a custom code per rule).

**API**
- All routes under `/api/v1`. JSON in and out.
- Errors always look like `{ "error": { "code": "SEAT_TAKEN", "message": "That seat was just taken." } }`.
- Authenticated routes expect `Authorization: Bearer <jwt>`. The token carries `userId`, `userType` and `clubIds`.

**Database error mapping (`db/errors.js`)**

| PostgreSQL code | Meaning | HTTP | Example code |
|---|---|---|---|
| `23505` unique_violation | seat taken, email exists, second successful payment | 409 | `SEAT_TAKEN`, `EMAIL_EXISTS` (chosen by constraint name) |
| `23P01` exclusion_violation | show overlaps another in the venue | 409 | `VENUE_BUSY` |
| `23514` check_violation | a CHECK failed | 422 | `INVALID_VALUE` |
| `23503` foreign_key_violation | referenced row missing or still in use | 409 | `REFERENCE_ERROR` |
| `P0001` raise_exception | a trigger rule (limit, window, price, manager…) | 422 | the trigger's own message |

---

## 5. Phases at a glance

| Phase | Dates | Goal | Suggested owner(s) |
|---|---|---|---|
| **0** Scaffold | 22–23 Oct | Repo layout, Docker, env files, API contract | Pranay (lead), everyone reviews |
| **1** Database foundation | 23–27 Oct | Schema, indexes, triggers, views, seed, rule tests | Areesha (tables, indexes, base seed), Harshitha (functions, triggers, views, tests) |
| **2** Backend and front-end skeleton + W1 | 26–30 Oct | Server, DB access, auth; login and register working | Geetanjali (backend and auth for W1), Rudhra (front-end skeleton, login and register pages) |
| **3** Browse | 30 Oct–2 Nov | Event list, search, show page, read-only seat map | Pranay |
| **4** Hold, pay, confirm (W2) | 31 Oct–6 Nov | Seat hold with Redis timer, payment, expiry, checkout screen | Rudhra |
| **5** Cancel (W3) and organizer setup (W4) | 5–9 Nov | Cancellations and event/show/price creation | Geetanjali |
| **6** Dashboard (W5) | 5–9 Nov | Report queries, views, charts | Pranay, Harshitha (queries) |
| **7** Data, testing, polish | 9–13 Nov | 500+ records, tests, demo script, README | Everyone |
| **Freeze** | 13–14 Nov | No new features; rehearse demo and viva | Everyone |
| **Submit** | 15 Nov | Final repository and documents | Pranay |

Owners are suggestions; change them if the team agrees. Phases 5 and 6 run in parallel, and Phase 2 starts as soon as the Phase 1 tables exist.

---

## 6. Phase details

### Phase 0 — Scaffold (22–23 Oct)

**Goal:** a repository where everyone knows where things go, and every teammate can start the database and Redis with one command.

- [x] Create the folder layout from section 3 (with `.gitkeep` in empty folders).
- [x] Move the two design PDFs into `docs/` (`Database_Design_Document.pdf`, `Application_Design.pdf`) and export the diagrams into `docs/architecture/`.
- [x] Update `database/README.md` to the numbered `schema/` layout above (it currently lists flat files).
- [x] `docker-compose.yml` with:
  - [x] `db`: `postgres:15-alpine`, health check with `pg_isready`, host port **5433**, named volume.
  - [x] `redis`: `redis:alpine` started with `--notify-keyspace-events Ex` (needed for hold-expiry events), health check, host port **6380**.
- [x] Root `.env.example` (DB user, password, name, ports) and `.gitignore` (node_modules, `.env`, build output).
- [x] `docs/api/API.md`: a table of every planned endpoint (method, path, auth, request body, response, errors), taken from the backend README. Agree on it as a team.
- [x] `database/scripts/apply.sh` and `reset.sh` (run files in numeric order using `psql`).
- [x] Git rules: protect `main` (pull request required), add a short pull-request template with the "done" checklist.
- [ ] Add each member as a collaborator; everyone makes one commit (fill in their row in the README).

**Checkpoint:** `docker compose up -d` gives a healthy Postgres and Redis on every laptop; `database/scripts/reset.sh` runs without errors (even with empty SQL files).

---

### Phase 1 — Database foundation (23–27 Oct)

**Goal:** the complete schema from the design document, running in PostgreSQL, with every rule provably enforced.

**Step 1 (by 24 Oct, Areesha) — unblock everyone**
- [x] `01_extensions.sql`: `CREATE EXTENSION IF NOT EXISTS btree_gist;`
- [x] `02_tables.sql`: all 15 tables with PKs, FKs (including the four composite FKs), `NOT NULL`, `UNIQUE`, `CHECK`, and the referential actions from the design (CASCADE vs RESTRICT).
- [x] `03_indexes.sql`: partial unique index on live tickets (BR1), `EXCLUDE USING gist` on shows (BR2), partial unique index on successful payments (BR15), search indexes (show start time, ticket by booking).
- [x] `seed/01_reference.sql`: one auditorium with seats and two categories, two classrooms (capacity set, one "General" category each), two clubs, a few users of each type, one club manager.
- [x] Push and tell the team: backend work can start.

**Step 2 (24–27 Oct, Harshitha)**
- [x] `04_functions.sql`: `expire_holds(show_id)` (marks unpaid PENDING bookings past `hold_expires_at` as EXPIRED and their HELD tickets as EXPIRED) and a no-argument version for the cron job.
- [x] `05_triggers.sql`: BR3 (seat vs venue type, capacity with `SELECT … FOR UPDATE` on the show), BR5 (price lookup and freeze), BR6 and BR14 (limits and subsidised ticket), BR7 (booking window), BR9 (user type vs subclass), BR10 (cancellation cascade), BR12, BR13, `total_amount` sync.
- [x] `06_views.sql`: `v_venue_capacity` plus the reporting views needed in Phase 6.
- [x] `seed/02_demo.sql`: events, shows, a few bookings, tickets and payments for development.

**Step 3 (everyone, in parallel) — rule tests**
- [x] One file in `database/tests/` per business rule: it runs inside a transaction, tries to violate the rule, and the expected error is written in a comment. Examples: two HELD tickets on one seat; overlapping shows; 7th ticket in a booking; classroom ticket with a seat; second successful payment.
- [x] A short `run_all.sh` that runs them and prints pass/fail.

**Checkpoint:** `reset.sh` builds the database from nothing; every `tests/` file fails in the expected way; the schema matches the relational diagram.

---

### Phase 2 — Backend and front-end skeleton, W1 (26–30 Oct)

**Goal:** a user can register and log in from the browser; shared plumbing exists for everything after.

**Backend (Geetanjali)**
- [ ] `config/env.js` (validate required variables at start-up), `db/pool.js`, `db/transaction.js`, `db/errors.js` (mapping table in section 4), `middleware/errorHandler.js`, `routes/v1.js`.
- [ ] `middleware/auth.js` (JWT) and `requireRole.js`.
- [ ] `modules/auth`: `POST /auth/register` (one transaction inserts `users` and the matching `student` / `faculty` / `guest` row; bcrypt the password), `POST /auth/login`, `GET /auth/me`.
- [ ] `GET /health` that checks Postgres and Redis.
- [ ] Jest + Supertest set up; first tests: register each user type, duplicate email, wrong password, bad roll number.

**Front end (Rudhra)**
- [ ] Vite + React + Tailwind + `react-router`; `api/client.js` that adds the token and shows server error messages.
- [ ] `AuthContext`, `ProtectedRoute`, `Login.jsx`, `Register.jsx` (type selector shows the right extra fields: roll number and year, employee id, affiliation).
- [ ] Layout with navigation that changes by role.

**Checkpoint (W1 done):** register as a student, faculty and guest; log in; refresh keeps you logged in; a duplicate email shows a clear message.

---

### Phase 3 — Browse (30 Oct–2 Nov)

**Goal:** an attendee can find a show and see which seats are free.

**Backend (`modules/events`, `modules/shows`)**
- [ ] `GET /events` with filters (type, genre, club, date range, free-text title) and sorting.
- [ ] `GET /events/:id` with its shows.
- [ ] `GET /shows/:id`: show details, venue, price per seat category and attendee type.
- [ ] `GET /shows/:id/seats`: every seat of the venue with status (free, held, sold) based on live tickets; for a classroom, return `capacity` and `remaining`.
- [ ] Indexes for the search queries (verify with `EXPLAIN`).

**Front end**
- [ ] `Events.jsx` with search box and filters.
- [ ] `ShowDetail.jsx` with `PriceTable` and a read-only `SeatMap` (rows and seats, colours for free, held, sold; quantity picker for classrooms).
- [ ] Re-fetch seat status every few seconds (polling).

**Checkpoint:** filters return correct events; the seat map matches what the database says; a seat held in `psql` shows as held in the UI.

---

### Phase 4 — Hold, pay, confirm (W2) (31 Oct–6 Nov)

**Goal:** the core workflow, end to end, with Redis as the timer. This is the main demo workflow, so start it early and review it carefully.

**Backend (`modules/bookings`, `modules/payments`, `redis/`, `jobs/`) — Rudhra**
- [ ] `POST /bookings` (hold):
  1. run `expire_holds(show_id)` so stale holds do not block seats;
  2. `BEGIN`; insert the PENDING booking with `hold_expires_at = now() + 5 minutes`;
  3. insert the HELD tickets (triggers set price and total, enforce limits);
  4. `COMMIT`;
  5. only then `SET hold:{booking_id} EX 300` in Redis.
  Return the booking and `hold_expires_at`. A unique violation returns `SEAT_TAKEN` and rolls back everything.
- [ ] `POST /bookings/:id/pay`: in one transaction lock the booking (`SELECT … FOR UPDATE`), check it is PENDING and not expired, insert the payment (simulated gateway reference), set booking CONFIRMED and tickets ACTIVE; then delete the Redis key.
- [ ] `GET /bookings/:id` and `GET /bookings/mine`.
- [ ] `redis/holds.js`: `setHold`, `clearHold`, and a subscriber for key-expiry events that calls `expire_holds()` for that booking.
- [ ] `jobs/expireHolds.js`: node-cron every 30 s calls the no-argument `expire_holds()` (safety net if an event is missed).
- [ ] Simulated gateway: always succeeds by default, with an option to simulate failure so the failed-attempt path can be shown (every attempt is recorded).
- [ ] `tests/concurrency/double-booking.js`: fire 20 parallel holds for the same seat, expect exactly one success and 19 `SEAT_TAKEN`.
- [ ] API tests: hold, pay, pay after expiry, 7th ticket, subsidised ticket rules, classroom capacity.

**Front end — Rudhra with Pranay**
- [ ] Seat selection in `SeatMap` (select up to 6, choose attendee type per seat).
- [ ] `Checkout.jsx` with `CountdownTimer` (uses the server's `hold_expires_at`, not the browser clock) and a pay button.
- [ ] Friendly handling of "seat just taken" (return to the seat map, refresh seats) and "hold expired".

**Checkpoint (W2 done):**
- [ ] Happy path: pick seats → hold → pay → tickets active.
- [ ] Wait 5 minutes (or shorten the hold in a test config) → hold expires, seats become free.
- [ ] Two browser sessions pick the same seat → exactly one succeeds.
- [ ] Stopping Redis does not break booking or allow double booking.

---

### Phase 5 — Cancel (W3) and organizer setup (W4) (5–9 Nov)

**Goal:** attendees can cancel; club managers can create everything an attendee sees.

**Backend — Geetanjali**
- [ ] `DELETE /bookings/:id` (cancel): rely on BR10 triggers (tickets cancelled, payment refunded); return the updated booking.
- [ ] `modules/organizer`, all behind `requireClubManager` (BR11):
  - [ ] `POST /organizer/events`, `PUT /organizer/events/:id`
  - [ ] `POST /organizer/shows` (venue and time), `POST /organizer/shows/:id/cancel`
  - [ ] `PUT /organizer/shows/:id/prices` (price grid per seat category and attendee type)
  - [ ] `GET /organizer/venues` (venues and categories for the forms)
- [ ] API tests: overlapping show → `VENUE_BUSY`; show shorter than event; price for another venue's category; non-manager → 403; cancel show cancels all bookings.

**Front end — Geetanjali with Rudhra**
- [ ] `MyBookings.jsx` with a cancel action and status badges.
- [ ] Organizer pages: `EventForm`, `ShowForm` (venue picker, time), `PriceGrid`, show cancel button.
- [ ] Show the database's rejection messages in the forms.

**Checkpoint (W3 and W4 done):** create an event, schedule two shows, set prices, book as an attendee, cancel the show, and see the booking cancelled and refunded; every invalid input is rejected with a clear message.

---

### Phase 6 — Dashboard (W5) (5–9 Nov)

**Goal:** the complex retrieval workflow, with the queries needed for the course requirements.

**Database — Harshitha**
- [ ] `database/queries/reports.sql` with at least five non-trivial queries, for example:

| # | Query | Techniques |
|---|---|---|
| 1 | Occupancy per show (live tickets vs capacity) | joins, `GROUP BY`, view `v_venue_capacity` |
| 2 | Revenue by event and attendee type | joins, `SUM`, `GROUP BY` |
| 3 | Top 5 events by revenue | CTE, ranking |
| 4 | Shows with seats still free / no live tickets | correlated subquery, `NOT EXISTS` |
| 5 | Most active attendees (more than N bookings) | `GROUP BY`, `HAVING` |

- [ ] Reporting views for occupancy and revenue.

**Backend (`modules/reports`) — Pranay**
- [ ] `GET /reports/occupancy`, `/reports/revenue`, `/reports/top-events`, restricted to club managers and limited to their own clubs.

**Front end — Pranay**
- [ ] `Dashboard.jsx` with tables and charts (`ReportCharts`), filters by event and date.

**Checkpoint (W5 done):** the dashboard numbers match hand-checked counts in `psql`.

---

### Phase 7 — Data, testing, polish (9–13 Nov)

**Goal:** a convincing, reproducible demo.

- [ ] **Data:** `seed/generate_seed.js` produces 500+ records (users, bookings, tickets, payments across several events and shows); `reset.sh` + seed rebuilds it in one command.
- [ ] **Constraint demo:** a short script that shows three or four rejections live (double booking, overlapping show, 7th ticket, second successful payment).
- [ ] **Testing:** run all `database/tests`, Jest API tests and the concurrency test; fix failures.
- [ ] **Error messages:** walk through the app with bad input on every form.
- [ ] **Docs:** final `README.md` with setup and run instructions, workflow descriptions and each member's contribution; update `docs/api/API.md`; export `postman_collection.json`; add screenshots.
- [ ] **Design document:** update the final 5-page PDF if the schema changed during implementation (keep ER/EER and schema in sync with the scripts).
- [ ] **Fresh-clone test:** a teammate clones the repo on a clean machine and follows the README only.
- [ ] **Viva practice:** each member explains the ER/EER diagram, one trigger, one query and one workflow of someone else.

**Stretch (only if everything above is done):** WebSocket live seat updates instead of polling; Dockerfiles for backend and front end so `docker compose up` starts everything; Postman test runs in CI.

---

### Freeze and submission (13–15 Nov)

- [ ] **13 Nov:** feature freeze. Only bug fixes and documentation after this point.
- [ ] **14 Nov:** full demo rehearsal with timing; prepare backup (screen recording, screenshots).
- [ ] **15 Nov:** repository matches what will be demoed; README, scripts, design PDF and sample data are in place; submit the link.

---

## 7. Definition of done (every slice)

1. Works through the UI, not only in Postman.
2. At least one bad input is rejected, with a clear message from the database rule.
3. SQL lives in `database/` or in a module's `*.queries.js`; no SQL in controllers or the front end.
4. Tests added (API test, rule test, or both).
5. `docs/api/API.md` updated if an endpoint changed.
6. Pull request reviewed by a teammate.
7. The author can explain the SQL and the transaction boundaries.

---

## 8. Mapping to the course requirements

| Requirement | Where we satisfy it |
|---|---|
| 3+ end-to-end workflows | W1 register, W2 hold-pay-confirm, W3 cancel, W4 organizer setup, W5 dashboard |
| A workflow with a transaction | W2 (hold, pay) and W1 (user + subclass row) |
| A workflow with complex retrieval | W5 dashboard, Phase 3 search |
| A workflow demonstrating constraint enforcement | W4 rejections and the double-booking demo |
| 5+ non-trivial SQL queries | `database/queries/reports.sql` |
| 3+ DBMS features | Transactions, triggers, partial unique and EXCLUDE indexes, views, `expire_holds()` function |
| 500+ records | `seed/generate_seed.js` |
| Reproducibility | `docker-compose.yml`, `reset.sh`, `.env.example`, README setup steps |

---

## 9. Risks and what to cut

| Risk | Mitigation |
|---|---|
| Schema delays everything | Phase 1 Step 1 (tables only) lands first; backend starts on it while triggers are still being written |
| Trigger bugs surface late | Rule tests in `database/tests` are written alongside each trigger, not at the end |
| W2 is harder than expected | Start Phase 4 early; keep W2 to one show type first (auditorium), then add classroom capacity |
| Redis not available on someone's laptop | Docker Compose; the app must still work (cron fallback) when Redis is down |
| Merge conflicts | Feature-per-module layout; each person works in their own module and page folders |
| Running out of time | Cut in this order: chart polish (keep tables), organizer edit screens (keep create), show cancellation UI (keep API). Never cut W2 or the double-booking demo |