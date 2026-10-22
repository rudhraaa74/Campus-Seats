# frontend/

React + Tailwind CSS single-page application for SeatSync. Attendees use it to browse events, select seats on an interactive map, hold them with a real-time countdown, and checkout; club organizers use it to schedule shows, set dynamic pricing, and view occupancy and revenue reports.

## Structure

```
frontend/
├── src/
│   ├── main.jsx               # entry point
│   ├── App.jsx                # router & navigation
│   ├── api/                   # API client (attaches JWT) & module endpoints
│   ├── context/
│   │   └── AuthContext.jsx    # global user auth & role state
│   ├── hooks/
│   │   └── useCountdown.js    # syncs with server's hold_expires_at
│   ├── pages/                 # screens
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Events.jsx
│   │   ├── ShowDetail.jsx
│   │   ├── Checkout.jsx
│   │   ├── MyBookings.jsx
│   │   └── organizer/
│   │       ├── EventForm.jsx
│   │       ├── ShowForm.jsx
│   │       ├── PriceGrid.jsx
│   │       └── Dashboard.jsx
│   ├── components/            # SeatMap, CountdownTimer, PriceTable, ReportCharts, ProtectedRoute
│   └── utils/
├── .env.example               # VITE_API_URL
├── index.html
├── vite.config.js
├── tailwind.config.js
├── README.md
└── package.json
```

## Screens

| Screen | Route | Who | Purpose | Workflow |
|---|---|---|---|---|
| Register / Login | `/register`, `/login` | Everyone | Create an account (Student, Faculty, Guest) and sign in | W1 |
| Event list | `/events` | Attendee | Search and filter events and shows by type, date, venue, club | W2 |
| Show page | `/shows/:id` | Attendee | Show details, prices per attendee type, interactive seat map | W2 |
| Checkout | `/checkout/:bookingId` | Attendee | Selected seats, 5-minute countdown, simulated payment | W2 |
| My bookings | `/my-bookings` | Attendee | View active tickets, cancel a booking | W3 |
| Organizer setup | `/organizer/events/new`, `/organizer/shows/new` | Club manager | Create events, shows, and price grids; cancel shows | W3, W4 |
| Dashboard | `/organizer/dashboard` | Club manager | Occupancy, revenue by event and attendee type, top events | W5 |

## Key components

- **SeatMap:** SVG/Canvas/CSS grid drawing the auditorium by row and seat; live free, held, and booked states.
- **CountdownTimer:** counts down to the server's `hold_expires_at` (never trusts client clock).
- **PriceTable:** displays prices categorized by seat category and user type.
- **ReportCharts:** occupancy and revenue analytics visualizations for organizers.
- **API Client:** Axios/Fetch wrapper attaching `Authorization: Bearer <token>` and handling standardized error responses.

## Quick start

```bash
# Copy environment variables
cp .env.example .env

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
