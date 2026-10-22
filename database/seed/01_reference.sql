-- ─────────────────────────────────────────────────────────────
-- seed/01_reference.sql
-- SeatSync — Base Reference Data
-- ─────────────────────────────────────────────────────────────
-- Sets up campus venues, physical seats, categories, clubs,
-- baseline users (Student, Faculty, Guest), and a club manager.
-- ─────────────────────────────────────────────────────────────

-- 1. CLUBS
INSERT INTO club (club_id, name, club_email, club_phone, description)
VALUES
    (1, 'Music Club', 'music.club@campus.ac.in', '9876543220', 'Official campus music society and band performance organizer.'),
    (2, 'Drama Society', 'drama.soc@campus.ac.in', '9876543221', 'Campus theatre, proscenium plays, and street play society.')
ON CONFLICT (club_id) DO NOTHING;

ALTER SEQUENCE club_club_id_seq RESTART WITH 3;

-- 2. USERS & SUBCLASSES (Password for demo accounts: "Password123!")
-- Using standard bcrypt hash for Password123!
INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type)
VALUES
    (1, 'manager@seatsync.ac.in', '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa', 'Pranay', 'Pratyush', '9876543210', 'STUDENT'),
    (2, 'student1@seatsync.ac.in', '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa', 'Rudhra', 'Koul', '9876543211', 'STUDENT'),
    (3, 'student2@seatsync.ac.in', '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa', 'Areesha', 'Shahid', '9876543212', 'STUDENT'),
    (4, 'faculty@seatsync.ac.in', '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa', 'Ramesh', 'Sharma', '9876543213', 'FACULTY'),
    (5, 'guest@seatsync.ac.in', '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa', 'John', 'Doe', '9876543214', 'GUEST')
ON CONFLICT (user_id) DO NOTHING;

ALTER SEQUENCE users_user_id_seq RESTART WITH 6;

-- Student subclass rows
INSERT INTO student (user_id, roll_no, year_of_study)
VALUES
    (1, '2023B5AA1211H', 3),
    (2, '2023B3AD0445H', 3),
    (3, '2023B1A40991H', 3)
ON CONFLICT (user_id) DO NOTHING;

-- Faculty subclass row
INSERT INTO faculty (user_id, employee_id, department)
VALUES
    (4, 'FAC_CS_101', 'Computer Science')
ON CONFLICT (user_id) DO NOTHING;

-- Guest subclass row
INSERT INTO guest (user_id, affiliation)
VALUES
    (5, 'Campus Alumni Network')
ON CONFLICT (user_id) DO NOTHING;

-- 3. CLUB MANAGERS
INSERT INTO club_manager (user_id, club_id, role)
VALUES
    (1, 1, 'ADMIN')
ON CONFLICT (user_id, club_id) DO NOTHING;

-- 4. VENUES
-- One Auditorium (capacity is NULL) and two Classrooms (capacity set)
INSERT INTO venue (venue_id, name, venue_type, capacity)
VALUES
    (1, 'Main Auditorium', 'AUDITORIUM', NULL),
    (2, 'Lecture Hall 101', 'CLASSROOM', 60),
    (3, 'Seminar Hall 201', 'CLASSROOM', 40)
ON CONFLICT (venue_id) DO NOTHING;

ALTER SEQUENCE venue_venue_id_seq RESTART WITH 4;

-- 5. SEAT CATEGORIES
INSERT INTO seat_category (category_id, venue_id, name)
VALUES
    (1, 1, 'Gold'),
    (2, 1, 'Silver'),
    (3, 2, 'General'),
    (4, 3, 'General')
ON CONFLICT (category_id) DO NOTHING;

ALTER SEQUENCE seat_category_category_id_seq RESTART WITH 5;

-- 6. AUDITORIUM SEATS (Main Auditorium: 500 numbered seats)
-- Main Floor / Stalls (Rows A to N = 14 rows * 25 seats = 350 seats, Silver = category 2)
INSERT INTO seat (venue_id, row_label, seat_no, category_id)
SELECT 1, chr(65 + r), s, 2
FROM generate_series(0, 13) AS r, generate_series(1, 25) AS s
ON CONFLICT (venue_id, row_label, seat_no) DO NOTHING;

-- Balcony / Upper Tier (Rows O to T = 6 rows * 25 seats = 150 seats, Gold = category 1)
INSERT INTO seat (venue_id, row_label, seat_no, category_id)
SELECT 1, chr(79 + r), s, 1
FROM generate_series(0, 5) AS r, generate_series(1, 25) AS s
ON CONFLICT (venue_id, row_label, seat_no) DO NOTHING;

