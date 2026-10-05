# SeatSync — Campus Venue Booking System

DBMS Course Project · Full-stack database application · Mid-Sem submission

> **Status: mid-sem.** Database and application design are complete. Implementation (SQL scripts, backend, front end) is the next phase. See [Progress](#progress).

## About

Campus events (shows, stand-up, screenings, fest events, talks) are held in the auditorium and in classrooms, but tickets are often sold without seat numbers, with no protection against over-selling and no data for organizers.

SeatSync lets students, faculty and guests book **exact seats** (auditorium) or **general-admission places** (classrooms) with subsidised student pricing, and gives organizing clubs occupancy and revenue reports.

**Users**

| Role | What they can do |
|---|---|
| Attendee (Student / Faculty / Guest) | Search events and shows, view the seat map, hold seats for 5 minutes, book, pay, view or cancel bookings |
| Club manager | Create events and shows, set the price grid, cancel shows, view occupancy and revenue reports |
| Database administrator | Sets up venues and seats through scripts |

## Team

| Name | ID | Contribution |
|---|---|---|
| | | |
| | | |
| | | |
| | | |

Lab session: 

## Tech stack

| Layer | Technology |
|---|---|
| Front end | React + Tailwind CSS |
| Backend | Node.js + Express, node-postgres (`pg`), JWT auth |
| Database | PostgreSQL |
| Hold timer | Redis (key TTL) |
| Scheduler | node-cron |

## Architecture

```
 Browser (React + Tailwind)
        |  HTTPS / JSON
        v
 API (Node.js + Express) ----- SET / DEL / expiry ----> Redis (hold timers, TTL 300 s)
        |  SQL (pg)
        v
 PostgreSQL  <---- expire_holds() every 30 s ---- node-cron job (in the API)
```

PostgreSQL is the source of truth and enforces all business rules. Redis is only a timer: if it goes down, no data is lost and no seat can be sold twice.

## Database design

15 relations: `users`, `student`, `faculty`, `guest`, `club`, `club_manager`, `venue`, `seat_category`, `seat`, `event`, `show`, `show_price`, `booking`, `ticket`, `payment`.

Main rules enforced by the DBMS:

- **No double booking:** partial `UNIQUE` index on live tickets (`HELD` / `ACTIVE`) per show and seat.
- **No overlapping shows in a venue:** `EXCLUDE USING gist` on the show time range.
- **Consistency across tables:** composite foreign keys keep a ticket's show, booking, venue and seat in agreement.
- **Business rules:** triggers for ticket limits, subsidised pricing, booking window, cancellation cascade and price checks.
- **One successful payment per booking:** partial `UNIQUE` index on payment.

Full ER/EER diagram, relational schema, constraints and design decisions are in [`docs/Database_Design_Document.pdf`](docs/Database_Design_Document.pdf).

## Main workflows

1. **Register / log in:** one transaction creates the user and its Student / Faculty / Guest row.
2. **Hold, pay, confirm:** pick seats → 5-minute hold → payment → tickets become `ACTIVE`.
3. **Cancel:** cancel a booking or a show; tickets are cancelled and payments refunded.
4. **Organizer setup:** create event → show → price grid, with invalid input rejected by the database.
5. **Organizer dashboard:** occupancy, revenue by event and attendee type, top events.

Details and sequence diagram: [`docs/Application_Design.pdf`](docs/Application_Design.pdf).

## Repository structure

```
.
├── docs/
│   ├── Database_Design_Document.pdf
│   └── Application_Design.pdf
├── database/          # schema, constraints, triggers, views, sample data (planned)
├── backend/           # Node.js + Express API (planned)
├── frontend/          # React + Tailwind app (planned)
└── README.md
```

## Setup and run

Coming with the final submission (database scripts, environment variables, backend and front-end start commands).

## Progress

- [x] Requirements, assumptions and business rules
- [x] ER and EER diagrams
- [x] Relational schema, keys, integrity constraints, design decisions
- [x] Application design: architecture, tech stack, workflows
- [ ] SQL scripts (tables, constraints, triggers, indexes, views)
- [ ] Sample data (at least 500 records)
- [ ] Backend API
- [ ] Front end
- [ ] Reports and dashboard
- [ ] Concurrency and constraint testing

## Timeline

| Date | Milestone |
|---|---|
| 11 Oct | Mid-sem submission |
| 15 Nov | Final submission |
| 17–19 Nov | Live demo and viva |