# backend/

Node.js + Express REST API for SeatSync. It is a thin layer between the front end and PostgreSQL: it starts transactions, calls the database, and turns database errors into clear messages. The business rules themselves are enforced in the database.

> **Status:** design complete (see `docs/Application_Design.pdf`), implementation to be done.

## Responsibilities

- Expose REST endpoints (JSON) for the front end
- Authenticate users with JWT and hash passwords with bcrypt
- Check that only club managers edit their own club's events, shows and prices
- Run multi-step operations as database transactions (`BEGIN` / `COMMIT` / `ROLLBACK`)
- Set and clear hold timers in Redis (key `hold:{booking_id}`, TTL 300 s)
- Run `expire_holds()` when a Redis key expires and on a 30-second `node-cron` job
- Serve report data from SQL queries and views

## Planned structure

```
backend/
├── src/
│   ├── index.js          # app entry point
│   ├── routes/           # auth, events, shows, bookings, payments, organizer, reports
│   ├── controllers/      # request handling
│   ├── db/               # pg pool and SQL queries
│   ├── middleware/       # JWT auth, role checks, error handler
│   ├── redis/            # Redis client and expiry listener
│   └── jobs/             # node-cron job calling expire_holds()
├── .env.example
└── package.json
```

## Planned endpoints

| Area | Endpoint | Workflow |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` | W1 |
| Browse | `GET /events`, `GET /shows/:id`, `GET /shows/:id/seats` | W2 |
| Booking | `POST /bookings` (hold), `POST /bookings/:id/pay`, `DELETE /bookings/:id` | W2, W3 |
| Organizer | `POST /events`, `POST /shows`, `PUT /shows/:id/prices`, `POST /shows/:id/cancel` | W3, W4 |
| Reports | `GET /reports/occupancy`, `GET /reports/revenue`, `GET /reports/top-events` | W5 |

## Rules to remember

- Use plain parameterised SQL through `pg` (no ORM).
- Every multi-table change runs in one transaction.
- When the database rejects an insert (unique violation, trigger exception), return a readable message, for example "seat already taken".
- Run `expire_holds()` for a show before inserting new holds, because an expired `HELD` ticket still blocks its seat until cleaned up.
- Redis is only a timer; never use it to decide who owns a seat.

## Environment variables (planned)

```
PORT=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
```

## Run (planned)

```
npm install
npm run dev
```