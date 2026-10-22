# backend/

Node.js + Express REST API for SeatSync. It is a thin layer between the front end and PostgreSQL: it starts transactions, calls the database, and turns database errors into clear messages. The business rules themselves are enforced in the database.

## Structure

```
backend/
├── src/
│   ├── index.js               # app entry point
│   ├── app.js                 # Express app, middleware, routes
│   ├── config/
│   │   └── env.js             # reads and validates environment variables
│   ├── db/
│   │   ├── pool.js            # pg connection pool
│   │   ├── transaction.js     # withTransaction(fn): BEGIN / COMMIT / ROLLBACK
│   │   └── errors.js          # maps PostgreSQL error codes to API errors
│   ├── redis/
│   │   ├── client.js
│   │   └── holds.js           # setHold / clearHold / expiry listener
│   ├── jobs/
│   │   └── expireHolds.js     # node-cron: calls expire_holds() every 30 s
│   ├── middleware/
│   │   ├── auth.js            # verifies JWT
│   │   ├── requireRole.js
│   │   ├── requireClubManager.js
│   │   ├── validate.js        # request body checks
│   │   └── errorHandler.js
│   ├── modules/               # one folder per feature
│   │   ├── auth/              # register, login (W1)
│   │   ├── events/            # list, search, detail
│   │   ├── shows/             # show detail, seat availability
│   │   ├── bookings/          # hold, pay, cancel (W2, W3)
│   │   ├── payments/          # simulated gateway
│   │   ├── organizer/         # events, shows, prices (W4)
│   │   └── reports/           # dashboard queries (W5)
│   ├── routes/
│   │   └── v1.js              # mounts every module under /api/v1
│   └── utils/
├── tests/
│   ├── api/                   # Jest + Supertest
│   └── concurrency/           # double-booking test
├── .env.example
└── package.json
```

## Each module

```
<name>.routes.js        # URL → controller + middleware
<name>.controller.js    # reads request, calls service, sends response
<name>.service.js       # business flow: transactions, queries, Redis
<name>.queries.js       # SQL strings
```

## Endpoints

See [`docs/api/API.md`](../docs/api/API.md) for the full contract.

| Area | Endpoint | Workflow |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | W1 |
| Browse | `GET /events`, `GET /events/:id`, `GET /shows/:id`, `GET /shows/:id/seats` | W2 |
| Booking | `POST /bookings`, `POST /bookings/:id/pay`, `DELETE /bookings/:id` | W2, W3 |
| Organizer | `POST /organizer/events`, `POST /organizer/shows`, `PUT /organizer/shows/:id/prices`, `POST /organizer/shows/:id/cancel` | W4 |
| Reports | `GET /reports/occupancy`, `GET /reports/revenue`, `GET /reports/top-events` | W5 |
| Health | `GET /health` | — |

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

## Environment variables

See [`.env.example`](.env.example).
