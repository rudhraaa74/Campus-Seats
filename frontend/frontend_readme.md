# frontend/

React + Tailwind CSS web app for SeatSync. Attendees use it to find events and book seats; club managers use it to set up events and view reports.

> **Status:** design complete (see `docs/Application_Design.pdf`), implementation to be done.

## Screens

| Screen | Who | Purpose | Workflow |
|---|---|---|---|
| Register / Login | Everyone | Create an account (Student, Faculty or Guest) and sign in | W1 |
| Event list | Attendee | Search and filter events and shows by type, date, venue, club | W2 |
| Show page | Attendee | Show details, prices per attendee type, interactive seat map | W2 |
| Checkout | Attendee | Selected seats, 5-minute countdown, simulated payment | W2 |
| My bookings | Attendee | View tickets, cancel a booking | W3 |
| Organizer setup | Club manager | Create events, shows and the price grid; cancel a show | W3, W4 |
| Dashboard | Club manager | Occupancy, revenue by event and attendee type, top events | W5 |

## Key components (planned)

- **SeatMap:** draws the auditorium by row and seat; shows free, held and sold seats
- **CountdownTimer:** counts down to the server's `hold_expires_at` (not the browser clock)
- **PriceTable:** prices per seat category and attendee type
- **ReportCharts:** occupancy and revenue charts for the dashboard
- **API client:** one module that talks to the backend and attaches the JWT

## Planned structure

```
frontend/
├── src/
│   ├── pages/         # one file per screen
│   ├── components/    # SeatMap, CountdownTimer, PriceTable, ReportCharts
│   ├── api/           # calls to the backend
│   └── App.jsx
├── tailwind.config.js
└── package.json
```

## Rules to remember

- The front end never decides whether a seat is free; the database does. Show the backend's error message when a seat was just taken.
- Show only the actions a role is allowed to use, but rely on the backend for the real permission check.
- Tickets for a booking are for one show, at most 6 at a time.

## Run (planned)

```
npm install
npm run dev
```