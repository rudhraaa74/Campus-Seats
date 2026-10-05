# database/

PostgreSQL scripts for SeatSync. This folder is the core of the project: the schema and the rules live here, not in the application code.

> **Status:** design complete (see `docs/Database_Design_Document.pdf`), scripts to be written.

## What will be here

| File | Contents |
|---|---|
| `schema.sql` | `CREATE TABLE` for all 15 relations with primary keys, foreign keys (including the composite ones), `NOT NULL`, `UNIQUE` and `CHECK` constraints |
| `indexes.sql` | Partial unique indexes (no double booking, one successful payment per booking), the `EXCLUDE USING gist` constraint on show times, and search indexes |
| `triggers.sql` | Business-rule triggers: ticket rules, subsidised pricing, booking window, cancellation cascade, price and show checks, `total_amount` sync, user-type match |
| `functions.sql` | Stored functions, mainly `expire_holds()` which marks unpaid bookings `EXPIRED` and frees their seats |
| `views.sql` | `v_venue_capacity` and reporting views (occupancy, revenue) |
| `seed.sql` | Sample data for the demo (at least 500 records): users, clubs, venues, seats, events, shows, bookings, tickets, payments |
| `queries.sql` | The non-trivial queries used by the dashboard and the demo (joins, `GROUP BY`, CTEs, subqueries) |

## Relations

`users`, `student`, `faculty`, `guest`, `club`, `club_manager`, `venue`, `seat_category`, `seat`, `event`, `show`, `show_price`, `booking`, `ticket`, `payment`

## Requirements

- PostgreSQL
- The `btree_gist` extension, needed for the `EXCLUDE` constraint on show times:
  `CREATE EXTENSION IF NOT EXISTS btree_gist;`

## Run order (planned)

1. `schema.sql`
2. `indexes.sql`
3. `functions.sql`
4. `triggers.sql`
5. `views.sql`
6. `seed.sql`

`queries.sql` is for running queries by hand and is not part of setup.

## Rules enforced here

| Rule | Mechanism |
|---|---|
| No double booking | Partial `UNIQUE` index on live tickets |
| No overlapping shows in a venue | `EXCLUDE` constraint |
| Ticket, show, venue and seat stay consistent | Composite foreign keys |
| Ticket limits, pricing, booking window, cancellation | Triggers |
| One successful payment per booking | Partial `UNIQUE` index |