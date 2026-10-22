# SeatSync — API Contract

> All endpoints are under `/api/v1`. Requests and responses are JSON.
>
> Authenticated routes require `Authorization: Bearer <jwt>`.
> The JWT payload contains `userId`, `userType` (`student` | `faculty` | `guest`), and `clubIds` (array).

---

## Error format

Every error response follows this shape:

```json
{
  "error": {
    "code": "SEAT_TAKEN",
    "message": "That seat was just taken."
  }
}
```

---

## Auth

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `POST` | `/auth/register` | No | Create a new account | W1 |
| `POST` | `/auth/login` | No | Sign in and receive a JWT | W1 |
| `GET` | `/auth/me` | Yes | Get the current user's profile | W1 |

### `POST /auth/register`

**Request:**
```json
{
  "email": "student@example.com",
  "password": "securepassword",
  "first_name": "Rudhra",
  "last_name": "Koul",
  "phone": "9876543210",
  "user_type": "student",
  "roll_number": "2023B3AD0445H",
  "year_of_study": 3
}
```

> `user_type` is one of `student`, `faculty`, `guest`.
> - `student` requires `roll_number` (string) and `year_of_study` (integer).
> - `faculty` requires `employee_id` (string) and `department` (string).
> - `guest` requires `affiliation` (string).

**Response (201):**
```json
{
  "token": "<jwt>",
  "user": {
    "user_id": 1,
    "email": "student@example.com",
    "first_name": "Rudhra",
    "last_name": "Koul",
    "user_type": "student"
  }
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `EMAIL_EXISTS` | 409 | Email already registered |
| `INVALID_VALUE` | 422 | Missing or invalid fields |

### `POST /auth/login`

**Request:**
```json
{
  "email": "student@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "token": "<jwt>",
  "user": { ... }
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |

### `GET /auth/me`

**Response (200):**
```json
{
  "user": {
    "user_id": 1,
    "email": "student@example.com",
    "first_name": "Rudhra",
    "last_name": "Koul",
    "user_type": "student",
    "roll_number": "2023B3AD0445H",
    "year_of_study": 3
  }
}
```

---

## Events

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `GET` | `/events` | No | List and search events | W2 |
| `GET` | `/events/:id` | No | Event detail with its shows | W2 |

### `GET /events`

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by event type |
| `genre` | string | Filter by genre |
| `club_id` | integer | Filter by organizing club |
| `from` | date | Shows starting on or after this date |
| `to` | date | Shows starting on or before this date |
| `q` | string | Free-text search on title |
| `sort` | string | `date_asc`, `date_desc`, `title` |
| `page` | integer | Page number (default 1) |
| `limit` | integer | Items per page (default 20, max 50) |

**Response (200):**
```json
{
  "events": [
    {
      "event_id": 1,
      "title": "Stand-up Night",
      "type": "comedy",
      "genre": "stand-up",
      "club_name": "Drama Club",
      "next_show_at": "2026-11-01T18:00:00Z",
      "shows_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

### `GET /events/:id`

**Response (200):**
```json
{
  "event": {
    "event_id": 1,
    "title": "Stand-up Night",
    "description": "...",
    "type": "comedy",
    "genre": "stand-up",
    "club": { "club_id": 1, "club_name": "Drama Club" },
    "shows": [
      {
        "show_id": 10,
        "venue_name": "Main Auditorium",
        "venue_type": "auditorium",
        "start_time": "2026-11-01T18:00:00Z",
        "end_time": "2026-11-01T20:00:00Z",
        "status": "scheduled"
      }
    ]
  }
}
```

---

## Shows

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `GET` | `/shows/:id` | No | Show details with prices | W2 |
| `GET` | `/shows/:id/seats` | No | Seat availability | W2 |

### `GET /shows/:id`

**Response (200):**
```json
{
  "show": {
    "show_id": 10,
    "event": { "event_id": 1, "title": "Stand-up Night" },
    "venue": { "venue_id": 1, "venue_name": "Main Auditorium", "venue_type": "auditorium" },
    "start_time": "2026-11-01T18:00:00Z",
    "end_time": "2026-11-01T20:00:00Z",
    "status": "scheduled",
    "prices": [
      {
        "category_name": "Balcony",
        "student_price": 100,
        "faculty_price": 150,
        "guest_price": 200
      },
      {
        "category_name": "Stalls",
        "student_price": 150,
        "faculty_price": 200,
        "guest_price": 300
      }
    ]
  }
}
```

### `GET /shows/:id/seats`

**Response (200) — auditorium:**
```json
{
  "venue_type": "auditorium",
  "seats": [
    {
      "seat_id": 1,
      "row_label": "A",
      "seat_number": 1,
      "category_name": "Balcony",
      "status": "free"
    },
    {
      "seat_id": 2,
      "row_label": "A",
      "seat_number": 2,
      "category_name": "Balcony",
      "status": "held"
    }
  ]
}
```

> `status` is one of `free`, `held`, `sold`.

**Response (200) — classroom:**
```json
{
  "venue_type": "classroom",
  "capacity": 60,
  "remaining": 45,
  "category_name": "General"
}
```

---

## Bookings

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `POST` | `/bookings` | Yes | Hold seats (create a PENDING booking) | W2 |
| `POST` | `/bookings/:id/pay` | Yes | Pay for a held booking | W2 |
| `GET` | `/bookings/:id` | Yes | Get booking details | W2 |
| `GET` | `/bookings/mine` | Yes | List the current user's bookings | W3 |
| `DELETE` | `/bookings/:id` | Yes | Cancel a booking | W3 |

### `POST /bookings`

**Request:**
```json
{
  "show_id": 10,
  "tickets": [
    { "seat_id": 1 },
    { "seat_id": 2 }
  ]
}
```

> For classrooms, omit `seat_id`; just send the number of tickets:
> ```json
> { "show_id": 20, "ticket_count": 3 }
> ```

> Maximum 6 tickets per booking.

**Response (201):**
```json
{
  "booking": {
    "booking_id": 100,
    "status": "PENDING",
    "hold_expires_at": "2026-11-01T18:05:00Z",
    "total_amount": 300,
    "tickets": [
      { "ticket_id": 501, "seat_id": 1, "row_label": "A", "seat_number": 1, "price": 150, "status": "HELD" },
      { "ticket_id": 502, "seat_id": 2, "row_label": "A", "seat_number": 2, "price": 150, "status": "HELD" }
    ]
  }
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `SEAT_TAKEN` | 409 | One or more seats already held or sold |
| `TICKET_LIMIT` | 422 | More than 6 tickets in one booking |
| `SHOW_NOT_BOOKABLE` | 422 | Show cancelled, past, or not in the booking window |
| `CAPACITY_FULL` | 409 | Classroom has no remaining seats |

### `POST /bookings/:id/pay`

**Request:**
```json
{
  "payment_method": "simulated_card"
}
```

**Response (200):**
```json
{
  "booking": {
    "booking_id": 100,
    "status": "CONFIRMED",
    "total_amount": 300,
    "payment": {
      "payment_id": 201,
      "amount": 300,
      "status": "SUCCESS",
      "paid_at": "2026-11-01T18:02:30Z"
    }
  }
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `HOLD_EXPIRED` | 410 | The 5-minute hold has lapsed |
| `ALREADY_PAID` | 409 | Booking is already confirmed |
| `PAYMENT_FAILED` | 422 | Simulated payment failure |

### `DELETE /bookings/:id`

**Response (200):**
```json
{
  "booking": {
    "booking_id": 100,
    "status": "CANCELLED"
  }
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `NOT_FOUND` | 404 | Booking does not exist or belongs to another user |
| `ALREADY_CANCELLED` | 409 | Booking was already cancelled |

---

## Organizer

> All organizer endpoints require authentication and the `club_manager` role.
> Managers can only manage events for their own club (BR11).

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `POST` | `/organizer/events` | Manager | Create an event | W4 |
| `PUT` | `/organizer/events/:id` | Manager | Update an event | W4 |
| `POST` | `/organizer/shows` | Manager | Schedule a show | W4 |
| `POST` | `/organizer/shows/:id/cancel` | Manager | Cancel a show | W4 |
| `PUT` | `/organizer/shows/:id/prices` | Manager | Set the price grid | W4 |
| `GET` | `/organizer/venues` | Manager | List venues and categories | W4 |

### `POST /organizer/events`

**Request:**
```json
{
  "title": "Stand-up Night",
  "description": "An evening of comedy",
  "type": "comedy",
  "genre": "stand-up"
}
```

**Response (201):**
```json
{
  "event": { "event_id": 1, "title": "Stand-up Night", ... }
}
```

### `POST /organizer/shows`

**Request:**
```json
{
  "event_id": 1,
  "venue_id": 1,
  "start_time": "2026-11-01T18:00:00Z",
  "end_time": "2026-11-01T20:00:00Z"
}
```

**Errors:**
| Code | HTTP | When |
|---|---|---|
| `VENUE_BUSY` | 409 | Another show overlaps in this venue |
| `INVALID_VALUE` | 422 | End before start, show outside event dates, etc. |

### `PUT /organizer/shows/:id/prices`

**Request:**
```json
{
  "prices": [
    { "category_id": 1, "student_price": 100, "faculty_price": 150, "guest_price": 200 },
    { "category_id": 2, "student_price": 150, "faculty_price": 200, "guest_price": 300 }
  ]
}
```

### `POST /organizer/shows/:id/cancel`

**Response (200):**
```json
{
  "show": { "show_id": 10, "status": "cancelled" },
  "cancelled_bookings": 5
}
```

---

## Reports

> Restricted to club managers; returns data for their own clubs only.

| Method | Path | Auth | Description | Workflow |
|---|---|---|---|---|
| `GET` | `/reports/occupancy` | Manager | Occupancy per show | W5 |
| `GET` | `/reports/revenue` | Manager | Revenue by event and attendee type | W5 |
| `GET` | `/reports/top-events` | Manager | Top events by revenue | W5 |

### `GET /reports/occupancy`

**Query:** `?event_id=1`

**Response (200):**
```json
{
  "shows": [
    {
      "show_id": 10,
      "venue_name": "Main Auditorium",
      "start_time": "2026-11-01T18:00:00Z",
      "capacity": 200,
      "sold": 150,
      "held": 10,
      "occupancy_pct": 75.0
    }
  ]
}
```

### `GET /reports/revenue`

**Response (200):**
```json
{
  "events": [
    {
      "event_id": 1,
      "title": "Stand-up Night",
      "total_revenue": 45000,
      "by_type": {
        "student": 20000,
        "faculty": 15000,
        "guest": 10000
      }
    }
  ]
}
```

### `GET /reports/top-events`

**Query:** `?limit=5`

**Response (200):**
```json
{
  "events": [
    { "event_id": 1, "title": "Stand-up Night", "total_revenue": 45000, "total_tickets": 300 }
  ]
}
```

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Check Postgres and Redis connectivity |

**Response (200):**
```json
{
  "status": "ok",
  "postgres": "connected",
  "redis": "connected"
}
```
