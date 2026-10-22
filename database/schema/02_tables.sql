-- ─────────────────────────────────────────────────────────────
-- 02_tables.sql
-- SeatSync — Relational Schema: All 15 Relations
-- ─────────────────────────────────────────────────────────────
-- Design mapping notes:
-- 1. All primary, foreign, unique, and check constraints are named
--    so the application backend (db/errors.js) can map error names
--    to friendly user messages.
-- 2. Composite foreign keys enforce cross-table consistency:
--    - ticket(booking_id, show_id) -> booking(booking_id, show_id)
--    - ticket(show_id, venue_id) -> show(show_id, venue_id)
--    - ticket(venue_id, row_label, seat_no) -> seat(venue_id, row_label, seat_no)
--    - seat(category_id, venue_id) -> seat_category(category_id, venue_id)
-- 3. Referential actions: CASCADE where child rows cannot exist without
--    the parent (subclasses, seats, prices, tickets, payments);
--    RESTRICT elsewhere to prevent accidental deletions of active events.
-- ─────────────────────────────────────────────────────────────

-- 1. USERS (Superclass)
-- Stores account credentials and role/type for all users.
CREATE TABLE users (
    user_id SERIAL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(20),
    user_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_users PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_type CHECK (user_type IN ('STUDENT', 'FACULTY', 'GUEST')),
    CONSTRAINT ck_users_email CHECK (email LIKE '%_@_%'),
    CONSTRAINT ck_users_phone CHECK (phone IS NULL OR phone ~ '^[0-9]{10,15}$')
);

-- 2. STUDENT (Subclass of users)
-- Stores roll number and study year for student attendees.
CREATE TABLE student (
    user_id INT NOT NULL,
    roll_no VARCHAR(50) NOT NULL,
    year_of_study INT NOT NULL,

    CONSTRAINT pk_student PRIMARY KEY (user_id),
    CONSTRAINT uq_student_roll_no UNIQUE (roll_no),
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT ck_student_year CHECK (year_of_study BETWEEN 1 AND 5)
);

-- 3. FACULTY (Subclass of users)
-- Stores employee id and department for faculty attendees.
CREATE TABLE faculty (
    user_id INT NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,

    CONSTRAINT pk_faculty PRIMARY KEY (user_id),
    CONSTRAINT uq_faculty_employee_id UNIQUE (employee_id),
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. GUEST (Subclass of users)
-- Stores external affiliation for general attendees.
CREATE TABLE guest (
    user_id INT NOT NULL,
    affiliation VARCHAR(100) NOT NULL,

    CONSTRAINT pk_guest PRIMARY KEY (user_id),
    CONSTRAINT fk_guest_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. CLUB
-- Student organisations and clubs that host campus events.
CREATE TABLE club (
    club_id SERIAL,
    name VARCHAR(150) NOT NULL,
    club_email VARCHAR(255) NOT NULL,
    club_phone VARCHAR(20),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_club PRIMARY KEY (club_id),
    CONSTRAINT uq_club_name UNIQUE (name),
    CONSTRAINT uq_club_email UNIQUE (club_email),
    CONSTRAINT ck_club_email CHECK (club_email LIKE '%_@_%'),
    CONSTRAINT ck_club_phone CHECK (club_phone IS NULL OR club_phone ~ '^[0-9]{10,15}$')
);

-- 6. CLUB_MANAGER (M:N relationship between users and club)
-- Users with permissions to schedule and manage events for a club.
CREATE TABLE club_manager (
    user_id INT NOT NULL,
    club_id INT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_club_manager PRIMARY KEY (user_id, club_id),
    CONSTRAINT fk_club_manager_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_club_manager_club FOREIGN KEY (club_id) REFERENCES club(club_id) ON DELETE CASCADE,
    CONSTRAINT ck_club_manager_role CHECK (role IN ('ADMIN', 'MEMBER'))
);

-- 7. VENUE
-- Venues on campus: AUDITORIUM (exact seat map) or CLASSROOM (general admission).
CREATE TABLE venue (
    venue_id SERIAL,
    name VARCHAR(150) NOT NULL,
    venue_type VARCHAR(20) NOT NULL,
    capacity INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_venue PRIMARY KEY (venue_id),
    CONSTRAINT uq_venue_name UNIQUE (name),
    CONSTRAINT ck_venue_type CHECK (venue_type IN ('AUDITORIUM', 'CLASSROOM')),
    CONSTRAINT ck_venue_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
    -- Capacity is stored ONLY for classrooms; auditorium capacity is computed dynamically from seats
    CONSTRAINT ck_venue_capacity_mode CHECK ((venue_type = 'CLASSROOM') = (capacity IS NOT NULL))
);

-- 8. SEAT_CATEGORY
-- Pricing tiers (e.g. Balcony, Gold, Regular) per venue.
-- Classrooms always have exactly one category: "General".
CREATE TABLE seat_category (
    category_id SERIAL,
    venue_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,

    CONSTRAINT pk_seat_category PRIMARY KEY (category_id),
    CONSTRAINT fk_seat_category_venue FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE,
    CONSTRAINT uq_seat_category_venue_name UNIQUE (venue_id, name),
    -- Composite unique key used as foreign key target for seat
    CONSTRAINT uq_seat_category_id_venue UNIQUE (category_id, venue_id)
);

-- 9. SEAT (Weak entity identified by venue_id + row_label + seat_no)
-- Individual physical seats in an auditorium.
CREATE TABLE seat (
    venue_id INT NOT NULL,
    row_label VARCHAR(10) NOT NULL,
    seat_no INT NOT NULL,
    category_id INT NOT NULL,

    CONSTRAINT pk_seat PRIMARY KEY (venue_id, row_label, seat_no),
    -- Enforces that a seat's category belongs to the exact same venue as the seat
    CONSTRAINT fk_seat_category_venue FOREIGN KEY (category_id, venue_id)
        REFERENCES seat_category(category_id, venue_id) ON DELETE CASCADE,
    CONSTRAINT ck_seat_row_label CHECK (row_label ~ '^[A-Z]{1,3}$'),
    CONSTRAINT ck_seat_no_positive CHECK (seat_no > 0)
);

-- 10. EVENT
-- An overarching event organized by a club (e.g. "Rock Fest 2026").
CREATE TABLE event (
    event_id SERIAL,
    club_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    duration_min INT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_event PRIMARY KEY (event_id),
    CONSTRAINT fk_event_club FOREIGN KEY (club_id) REFERENCES club(club_id) ON DELETE RESTRICT,
    CONSTRAINT ck_event_type CHECK (event_type IN ('CULTURAL', 'TECHNICAL', 'SPORTS', 'ACADEMIC', 'OTHER')),
    CONSTRAINT ck_event_duration CHECK (duration_min > 0)
);

-- 11. SHOW
-- An individual time-slot screening or performance of an event at a venue.
CREATE TABLE show (
    show_id SERIAL,
    event_id INT NOT NULL,
    venue_id INT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    allowed_attendees TEXT[] NOT NULL DEFAULT ARRAY['STUDENT', 'FACULTY', 'GUEST'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_show PRIMARY KEY (show_id),
    CONSTRAINT fk_show_event FOREIGN KEY (event_id) REFERENCES event(event_id) ON DELETE RESTRICT,
    CONSTRAINT fk_show_venue FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE RESTRICT,
    CONSTRAINT ck_show_status CHECK (status IN ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT ck_show_time_range CHECK (end_time > start_time),
    -- Composite unique key used as foreign key target for ticket
    CONSTRAINT uq_show_venue UNIQUE (show_id, venue_id)
);

-- 12. SHOW_PRICE (Weak entity with owners SHOW and SEAT_CATEGORY)
-- Price grid: cost per attendee type for each seat category of a show.
CREATE TABLE show_price (
    show_id INT NOT NULL,
    category_id INT NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,

    CONSTRAINT pk_show_price PRIMARY KEY (show_id, category_id, user_type),
    CONSTRAINT fk_show_price_show FOREIGN KEY (show_id) REFERENCES show(show_id) ON DELETE CASCADE,
    CONSTRAINT fk_show_price_category FOREIGN KEY (category_id) REFERENCES seat_category(category_id) ON DELETE CASCADE,
    CONSTRAINT ck_show_price_user_type CHECK (user_type IN ('STUDENT', 'FACULTY', 'GUEST')),
    CONSTRAINT ck_show_price_non_negative CHECK (price >= 0)
);

-- 13. BOOKING
-- An order placed by a user for tickets to a specific show.
-- Initially PENDING with a 5-minute hold_expires_at window.
CREATE TABLE booking (
    booking_id SERIAL,
    user_id INT NOT NULL,
    show_id INT NOT NULL,
    booked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hold_expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT pk_booking PRIMARY KEY (booking_id),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_show FOREIGN KEY (show_id) REFERENCES show(show_id) ON DELETE RESTRICT,
    CONSTRAINT ck_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT ck_booking_total_amount CHECK (total_amount >= 0),
    CONSTRAINT ck_booking_hold_window CHECK (hold_expires_at > booked_at),
    -- Composite unique key used as foreign key target for ticket
    CONSTRAINT uq_booking_show UNIQUE (booking_id, show_id)
);

-- 14. TICKET
-- An individual seat or general-admission pass within a booking.
-- Classroom tickets have NULL row_label and seat_no.
CREATE TABLE ticket (
    ticket_id SERIAL,
    booking_id INT NOT NULL,
    show_id INT NOT NULL,
    venue_id INT NOT NULL,
    row_label VARCHAR(10),
    seat_no INT,
    attendee_type VARCHAR(20) NOT NULL,
    price_paid NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HELD',

    CONSTRAINT pk_ticket PRIMARY KEY (ticket_id),
    -- Composite FK: Guarantees ticket's show always matches its booking's show
    CONSTRAINT fk_ticket_booking_show FOREIGN KEY (booking_id, show_id)
        REFERENCES booking(booking_id, show_id) ON DELETE CASCADE,
    -- Composite FK: Guarantees ticket's venue always matches its show's venue
    CONSTRAINT fk_ticket_show_venue FOREIGN KEY (show_id, venue_id)
        REFERENCES show(show_id, venue_id) ON DELETE CASCADE,
    -- Composite FK: Guarantees seat belongs to the same venue as the show
    CONSTRAINT fk_ticket_seat FOREIGN KEY (venue_id, row_label, seat_no)
        REFERENCES seat(venue_id, row_label, seat_no) ON DELETE CASCADE,
    -- Either both row and seat are specified (Auditorium), or both are NULL (Classroom)
    CONSTRAINT ck_ticket_seat_pair CHECK ((row_label IS NULL) = (seat_no IS NULL)),
    CONSTRAINT ck_ticket_attendee_type CHECK (attendee_type IN ('STUDENT', 'FACULTY', 'GUEST')),
    CONSTRAINT ck_ticket_price_paid CHECK (price_paid >= 0),
    CONSTRAINT ck_ticket_status CHECK (status IN ('HELD', 'ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- 15. PAYMENT
-- Transaction record for a booking through the simulated gateway.
CREATE TABLE payment (
    payment_id SERIAL,
    booking_id INT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    gateway_ref VARCHAR(100) NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_payment PRIMARY KEY (payment_id),
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES booking(booking_id) ON DELETE CASCADE,
    CONSTRAINT uq_payment_gateway_ref UNIQUE (gateway_ref),
    CONSTRAINT ck_payment_amount CHECK (amount > 0),
    CONSTRAINT ck_payment_method CHECK (payment_method IN ('UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'SIMULATED')),
    CONSTRAINT ck_payment_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    CONSTRAINT ck_payment_paid_at_status CHECK ((status IN ('SUCCESS', 'REFUNDED')) = (paid_at IS NOT NULL))
);
