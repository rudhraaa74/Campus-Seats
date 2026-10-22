// ─────────────────────────────────────────────────────────────
// database/seed/generate_seed.js
// SeatSync — High-Volume Realistic Dataset Generator
// Populates 500+ records (Users, Subclasses, Clubs, Venues,
// Physical Seats, Events, Shows, Prices, Bookings, Tickets, Payments)
// ─────────────────────────────────────────────────────────────

import { pool } from '../../backend/src/db/pool.js';

// Standard bcrypt hash for password "Password123!"
const DEMO_PW_HASH = '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa';

async function seed() {
  const client = await pool.connect();
  console.log('═'.repeat(60));
  console.log('🚀 SeatSync — Generating 500+ Record Production Seed Dataset');
  console.log('═'.repeat(60));

  try {
    await client.query('BEGIN;');

    // 0. Clean previous dynamic demo / test transactions
    console.log('  → Cleaning previous dynamic demo/test transactions...');
    await client.query('DELETE FROM payment;');
    await client.query('DELETE FROM ticket;');
    await client.query('DELETE FROM booking;');
    await client.query('DELETE FROM show_price;');
    await client.query('DELETE FROM show;');
    await client.query('DELETE FROM event;');
    await client.query('DELETE FROM student WHERE user_id > 9;');
    await client.query('DELETE FROM faculty WHERE user_id > 9;');
    await client.query('DELETE FROM guest WHERE user_id > 9;');
    await client.query('DELETE FROM club_manager WHERE user_id > 9;');
    await client.query('DELETE FROM users WHERE user_id > 9;');

    // ─────────────────────────────────────────────────────────
    // 1. CLUBS & SOCIETIES
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding Clubs & Societies...');
    const clubsData = [
      [1, 'Music Club', 'music.club@campus.ac.in', '9876543220', 'Official campus music society and band performance organizer.'],
      [2, 'Drama Society', 'drama.soc@campus.ac.in', '9876543221', 'Campus theatre, proscenium plays, and street play society.'],
      [3, 'Tech & Robotics Club', 'tech.club@campus.ac.in', '9876543222', 'Hackathons, robotics championships, and AI symposiums.'],
      [4, 'Literary Society', 'literary.soc@campus.ac.in', '9876543223', 'National debates, poetry slams, and literary festivals.'],
      [5, 'Sports Council', 'sports.council@campus.ac.in', '9876543224', 'Inter-hostel leagues, badminton, futsal, and athletics.']
    ];

    for (const c of clubsData) {
      await client.query(`
        INSERT INTO club (club_id, name, club_email, club_phone, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (club_id) DO UPDATE SET
          name = EXCLUDED.name,
          club_email = EXCLUDED.club_email,
          description = EXCLUDED.description;
      `, c);
    }
    await client.query(`SELECT setval('club_club_id_seq', (SELECT MAX(club_id) FROM club));`);

    // ─────────────────────────────────────────────────────────
    // 2. VENUES & PHYSICAL SEATING
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding Venues & Physical 500-Seat Auditorium...');
    const venuesData = [
      [1, 'Main Auditorium', 'AUDITORIUM', null],
      [2, 'Lecture Hall 101', 'CLASSROOM', 60],
      [3, 'Seminar Hall 202', 'CLASSROOM', 40],
      [4, 'Open Air Amphitheatre', 'CLASSROOM', 120]
    ];

    for (const v of venuesData) {
      await client.query(`
        INSERT INTO venue (venue_id, name, venue_type, capacity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (venue_id) DO UPDATE SET
          name = EXCLUDED.name,
          venue_type = EXCLUDED.venue_type,
          capacity = EXCLUDED.capacity;
      `, v);
    }
    await client.query(`SELECT setval('venue_venue_id_seq', (SELECT MAX(venue_id) FROM venue));`);

    // Seat Categories
    const categoriesData = [
      [1, 1, 'Gold'],
      [2, 1, 'Silver'],
      [3, 2, 'General'],
      [4, 3, 'General'],
      [5, 4, 'General']
    ];
    for (const cat of categoriesData) {
      const existing = await client.query('SELECT category_id FROM seat_category WHERE venue_id = $1;', [cat[1]]);
      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO seat_category (category_id, venue_id, name)
          VALUES ($1, $2, $3);
        `, cat);
      }
    }
    await client.query(`SELECT setval('seat_category_category_id_seq', (SELECT MAX(category_id) FROM seat_category));`);

    // Ensure Auditorium 500 physical seats exist (Rows A-T, 1-25)
    const existingSeatsCount = (await client.query('SELECT COUNT(*) FROM seat WHERE venue_id = 1;')).rows[0].count;
    if (parseInt(existingSeatsCount, 10) < 500) {
      console.log('    • Generating 500 numbered seats in Main Auditorium (Rows A-T, 1-25)...');
      const rows = 'ABCDEFGHIJKLMNOPQRST'.split('');
      for (const row of rows) {
        // Rows A-H: Silver (cat 2), Rows I-T: Gold (cat 1)
        const catId = 'ABCDEFGH'.includes(row) ? 2 : 1;
        for (let seatNo = 1; seatNo <= 25; seatNo++) {
          await client.query(`
            INSERT INTO seat (venue_id, row_label, seat_no, category_id)
            VALUES (1, $1, $2, $3)
            ON CONFLICT (venue_id, row_label, seat_no) DO NOTHING;
          `, [row, seatNo, catId]);
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. USERS & SUBCLASSES (Students, Faculty, Guests, Managers)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 65+ Users across Students, Faculty, Guests, and Managers...');

    // A. Base Named Demo Users
    const namedUsers = [
      { id: 1, email: 'manager@seatsync.ac.in', first: 'Pranay', last: 'Pratyush', phone: '9876543210', type: 'STUDENT', roll: '2023B5AA1211H', year: 3, clubRole: { clubId: 1, role: 'ADMIN' } },
      { id: 2, email: 'student1@seatsync.ac.in', first: 'Rudhra', last: 'Koul', phone: '9876543211', type: 'STUDENT', roll: '2023B3AD0445H', year: 3 },
      { id: 3, email: 'student2@seatsync.ac.in', first: 'Areesha', last: 'Shahid', phone: '9876543212', type: 'STUDENT', roll: '2023B1A40991H', year: 3 },
      { id: 4, email: 'faculty@seatsync.ac.in', first: 'Ramesh', last: 'Sharma', phone: '9876543213', type: 'FACULTY', empId: 'FAC_CS_101', dept: 'Computer Science' },
      { id: 5, email: 'guest@seatsync.ac.in', first: 'John', last: 'Doe', phone: '9876543214', type: 'GUEST', aff: 'Campus Alumni Network' },
      // Club managers for remaining clubs
      { id: 6, email: 'drama.head@seatsync.ac.in', first: 'Harshitha', last: 'Ambavarapu', phone: '9876543215', type: 'STUDENT', roll: '2023B2AD0873H', year: 3, clubRole: { clubId: 2, role: 'ADMIN' } },
      { id: 7, email: 'tech.head@seatsync.ac.in', first: 'Geetanjali', last: 'Dangeti', phone: '9876543216', type: 'STUDENT', roll: '2023B4AD0609H', year: 3, clubRole: { clubId: 3, role: 'ADMIN' } },
      { id: 8, email: 'lit.head@seatsync.ac.in', first: 'Vikram', last: 'Seth', phone: '9876543217', type: 'FACULTY', empId: 'FAC_HUM_202', dept: 'Humanities & Social Sciences', clubRole: { clubId: 4, role: 'ADMIN' } },
      { id: 9, email: 'sports.head@seatsync.ac.in', first: 'Sunil', last: 'Chhetri', phone: '9876543218', type: 'STUDENT', roll: '2022A7PS0012H', year: 4, clubRole: { clubId: 5, role: 'ADMIN' } },
    ];

    for (const u of namedUsers) {
      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          user_type = EXCLUDED.user_type;
      `, [u.id, u.email, DEMO_PW_HASH, u.first, u.last, u.phone, u.type]);

      if (u.type === 'STUDENT') {
        await client.query(`
          INSERT INTO student (user_id, roll_no, year_of_study)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET roll_no = EXCLUDED.roll_no, year_of_study = EXCLUDED.year_of_study;
        `, [u.id, u.roll, u.year]);
      } else if (u.type === 'FACULTY') {
        await client.query(`
          INSERT INTO faculty (user_id, employee_id, department)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET employee_id = EXCLUDED.employee_id, department = EXCLUDED.department;
        `, [u.id, u.empId, u.dept]);
      } else if (u.type === 'GUEST') {
        await client.query(`
          INSERT INTO guest (user_id, affiliation)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET affiliation = EXCLUDED.affiliation;
        `, [u.id, u.aff]);
      }

      if (u.clubRole) {
        await client.query(`
          INSERT INTO club_manager (user_id, club_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, club_id) DO NOTHING;
        `, [u.id, u.clubRole.clubId, u.clubRole.role]);
      }
    }

    // B. Bulk Generate 35 Additional Students
    const studentFirstNames = ['Aarav', 'Ananya', 'Rohan', 'Sneha', 'Kabir', 'Isha', 'Aditya', 'Diya', 'Kunal', 'Pooja', 'Tanmay', 'Meera', 'Dhruv', 'Riya', 'Arjun', 'Sanjana', 'Manish', 'Neha', 'Varun', 'Kriti', 'Harsh', 'Simran', 'Akash', 'Shruti', 'Nikhil', 'Tanvi', 'Abhishek', 'Sakshi', 'Gaurav', 'Payal', 'Siddharth', 'Pallavi', 'Yash', 'Anushka', 'Vivek'];
    const studentLastNames = ['Patel', 'Reddy', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Bhatia', 'Joshi', 'Chauhan', 'Saxena', 'Mehta', 'Kaur', 'Das', 'Pandey', 'Mishra'];

    let nextUserId = 10;
    for (let i = 0; i < studentFirstNames.length; i++) {
      const uid = nextUserId++;
      const first = studentFirstNames[i];
      const last = studentLastNames[i % studentLastNames.length];
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${uid}@campus.ac.in`;
      const roll = `2024B${(i % 5) + 1}AA${(100 + i).toString()}H`;
      const year = (i % 4) + 1;

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5, $6, 'STUDENT')
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, email, DEMO_PW_HASH, first, last, `981100${1000 + uid}`]);

      await client.query(`
        INSERT INTO student (user_id, roll_no, year_of_study)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, roll, year]);
    }

    // C. Bulk Generate 10 Additional Faculty
    const facultyDepts = ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Physics', 'Mathematics', 'Humanities', 'Biological Sciences', 'Chemical Engineering'];
    for (let i = 0; i < 10; i++) {
      const uid = nextUserId++;
      const first = ['Dr. Rajesh', 'Dr. Sunita', 'Dr. Arvind', 'Dr. Priya', 'Dr. Mohan', 'Dr. Kavita', 'Dr. Deepak', 'Dr. Swati', 'Dr. Alok', 'Dr. Meenakshi'][i];
      const last = studentLastNames[(i + 3) % studentLastNames.length];
      const email = `faculty.${uid}@campus.ac.in`;
      const empId = `FAC_DEPT_${200 + i}`;
      const dept = facultyDepts[i % facultyDepts.length];

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5, $6, 'FACULTY')
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, email, DEMO_PW_HASH, first, last, `982200${1000 + uid}`]);

      await client.query(`
        INSERT INTO faculty (user_id, employee_id, department)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, empId, dept]);
    }

    // D. Bulk Generate 10 Additional Guests
    const guestAffiliations = ['BITS Alumni Association', 'Delhi University', 'IIT Hyderabad', 'Visiting Parent', 'Industry Partner (Google)', 'Cultural Delegate', 'Press & Media'];
    for (let i = 0; i < 10; i++) {
      const uid = nextUserId++;
      const first = ['Robert', 'Emily', 'David', 'Sarah', 'Michael', 'Jessica', 'Thomas', 'Laura', 'James', 'Rachel'][i];
      const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor'][i];
      const email = `guest.${uid}@external.org`;
      const aff = guestAffiliations[i % guestAffiliations.length];

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5, $6, 'GUEST')
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, email, DEMO_PW_HASH, first, last, `983300${1000 + uid}`]);

      await client.query(`
        INSERT INTO guest (user_id, affiliation)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, aff]);
    }
    await client.query(`SELECT setval('users_user_id_seq', (SELECT MAX(user_id) FROM users));`);

    // ─────────────────────────────────────────────────────────
    // 4. EVENTS
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 8 Campus Events...');
    const eventsData = [
      [1, 1, 'Campus Rock Night 2026', 'CULTURAL', 180, 'Annual rock concert featuring campus headliners and visiting indie bands.'],
      [2, 2, 'The Tempest: Annual Production', 'CULTURAL', 120, "A modern proscenium theatrical adaptation of Shakespeare's The Tempest."],
      [3, 1, 'Acoustic Unplugged', 'CULTURAL', 90, 'An intimate evening of acoustic music in a classroom setting.'],
      [4, 4, 'National Parliamentary Debate', 'ACADEMIC', 120, 'Premier Asian Parliamentary format inter-university debate championship.'],
      [5, 5, 'Inter-Hostel Futsal Finals', 'SPORTS', 90, 'High-octane five-a-side futsal tournament finale and trophy presentation.'],
      [6, 1, 'Classical Sitar & Tabla Jugalbandi', 'CULTURAL', 120, 'An evening of classical Indian ragas and rhythmic percussion mastery.'],
      [7, 2, 'Standup Comedy Campus Open Mic', 'CULTURAL', 90, 'Campus comic stars and guest standup artists live on stage.'],
      [8, 3, 'Robocon & Drone Race Challenge', 'TECHNICAL', 120, 'Autonomous bot navigation, obstacle courses, and high-speed drone racing.']
    ];

    for (const ev of eventsData) {
      await client.query(`
        INSERT INTO event (event_id, club_id, title, event_type, duration_min, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO UPDATE SET
          title = EXCLUDED.title,
          event_type = EXCLUDED.event_type,
          duration_min = EXCLUDED.duration_min,
          description = EXCLUDED.description;
      `, ev);
    }
    await client.query(`SELECT setval('event_event_id_seq', (SELECT MAX(event_id) FROM event));`);

    // ─────────────────────────────────────────────────────────
    // 5. SHOWS & PRICING
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 14 Non-Overlapping Scheduled Shows across Venues...');

    // Base future anchor: 2026-11-10 18:00 UTC
    // Shows are carefully non-overlapping in each venue to satisfy BR2 (GiST exclusion constraint)
    const showsData = [
      // Main Auditorium (Venue 1)
      [1, 1, 1, '2026-11-10 18:00:00+00', '2026-11-10 21:00:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [2, 2, 1, '2026-11-11 18:00:00+00', '2026-11-11 20:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      // Show 3: Classroom in Lecture Hall 101 (Venue 2, cap 60)
      [3, 3, 2, '2026-11-12 17:00:00+00', '2026-11-12 19:00:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [4, 8, 1, '2026-11-13 14:00:00+00', '2026-11-13 16:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],

      // Lecture Hall 101 (Venue 2, Classroom cap 60)
      [5, 4, 2, '2026-11-10 16:00:00+00', '2026-11-10 18:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [6, 6, 2, '2026-11-11 17:00:00+00', '2026-11-11 19:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [7, 7, 2, '2026-11-13 18:00:00+00', '2026-11-13 20:00:00+00', 'SCHEDULED', ['STUDENT']], // Student Exclusive!
      [8, 8, 2, '2026-11-14 10:00:00+00', '2026-11-14 12:30:00+00', 'SCHEDULED', ['FACULTY']], // Faculty Exclusive!

      // Seminar Hall 202 (Venue 3, Classroom cap 40)
      [9, 4, 3, '2026-11-11 14:00:00+00', '2026-11-11 16:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [10, 6, 3, '2026-11-13 18:00:00+00', '2026-11-13 20:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY']],
      [11, 7, 3, '2026-11-15 17:00:00+00', '2026-11-15 19:00:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],

      // Open Air Amphitheatre (Venue 4, Classroom cap 120)
      [12, 5, 4, '2026-11-10 17:00:00+00', '2026-11-10 19:00:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [13, 1, 4, '2026-11-14 18:00:00+00', '2026-11-14 21:30:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [14, 5, 4, '2026-11-16 16:00:00+00', '2026-11-16 18:00:00+00', 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']]
    ];

    for (const s of showsData) {
      await client.query(`
        INSERT INTO show (show_id, event_id, venue_id, start_time, end_time, status, allowed_attendees)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (show_id) DO UPDATE SET
          venue_id = EXCLUDED.venue_id,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status,
          allowed_attendees = EXCLUDED.allowed_attendees;
      `, s);
    }
    await client.query(`SELECT setval('show_show_id_seq', (SELECT MAX(show_id) FROM show));`);

    // Show Prices
    console.log('  → Seeding Show Pricing Matrices...');
    // Auditorium shows: Cat 1 (Gold) & Cat 2 (Silver)
    for (const showId of [1, 2, 4]) {
      const isGoldHigher = showId === 1;
      await client.query(`
        INSERT INTO show_price (show_id, category_id, user_type, price)
        VALUES
          ($1, 1, 'STUDENT', $2), ($1, 1, 'FACULTY', $3), ($1, 1, 'GUEST', $4),
          ($1, 2, 'STUDENT', $5), ($1, 2, 'FACULTY', $6), ($1, 2, 'GUEST', $7)
        ON CONFLICT (show_id, category_id, user_type) DO UPDATE SET price = EXCLUDED.price;
      `, [
        showId,
        isGoldHigher ? 100.00 : 80.00,
        isGoldHigher ? 150.00 : 120.00,
        isGoldHigher ? 250.00 : 200.00,
        isGoldHigher ? 60.00 : 50.00,
        isGoldHigher ? 100.00 : 80.00,
        isGoldHigher ? 150.00 : 120.00
      ]);
    }

    // Classroom shows (Venue 2: Cat 3, Venue 3: Cat 4, Venue 4: Cat 5)
    const classroomShowCat = {
      3: 3, 5: 3, 6: 3, 7: 3, 8: 3,
      9: 4, 10: 4, 11: 4,
      12: 5, 13: 5, 14: 5
    };

    for (const [sId, cId] of Object.entries(classroomShowCat)) {
      await client.query(`
        INSERT INTO show_price (show_id, category_id, user_type, price)
        VALUES
          ($1, $2, 'STUDENT', 20.00),
          ($1, $2, 'FACULTY', 50.00),
          ($1, $2, 'GUEST', 80.00)
        ON CONFLICT (show_id, category_id, user_type) DO UPDATE SET price = EXCLUDED.price;
      `, [parseInt(sId, 10), cId]);
    }

    // ─────────────────────────────────────────────────────────
    // 6. HIGH-VOLUME BOOKINGS, TICKETS & PAYMENTS (400+ Records)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding Baseline & Bulk Bookings, Tickets, and Payments...');

    // Clear dynamic transactional seed tables cleanly
    await client.query('DELETE FROM payment;');
    await client.query('DELETE FROM ticket;');
    await client.query('DELETE FROM booking;');

    // Pre-assign Baseline Test Bookings 1, 2, 3
    // Booking 1: Rudhra (user 2) for Show 1 (O-1 STUDENT: 100, O-2 GUEST: 250 = 350)
    await client.query(`
      INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
      VALUES (1, 2, 1, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '55 minutes', 'CONFIRMED', 350.00);
    `);
    await client.query(`
      INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES
        (1, 1, 1, 1, 'O', 1, 'STUDENT', 100.00, 'ACTIVE'),
        (2, 1, 1, 1, 'O', 2, 'GUEST', 250.00, 'ACTIVE');
    `);
    await client.query(`
      INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
      VALUES (1, 1, 350.00, 'UPI', 'SUCCESS', 'DEMO_PAY_001', CURRENT_TIMESTAMP - INTERVAL '58 minutes');
    `);

    // Booking 2: Areesha (user 3) for Show 1 (B-5 STUDENT: 60, HELD)
    await client.query(`
      INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
      VALUES (2, 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 'PENDING', 60.00);
    `);
    await client.query(`
      INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES (3, 2, 1, 1, 'B', 5, 'STUDENT', 60.00, 'HELD');
    `);

    // Booking 3: Faculty Ramesh (user 4) for Show 3 (Classroom 101, General pass FACULTY: 50, ACTIVE)
    await client.query(`
      INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
      VALUES (3, 4, 3, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes', 'CONFIRMED', 50.00);
    `);
    await client.query(`
      INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES (4, 3, 3, 2, NULL, NULL, 'FACULTY', 50.00, 'ACTIVE');
    `);
    await client.query(`
      INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
      VALUES (2, 3, 50.00, 'CREDIT_CARD', 'SUCCESS', 'DEMO_PAY_002', CURRENT_TIMESTAMP - INTERVAL '28 minutes');
    `);

    let bookingIdCounter = 4;
    let ticketIdCounter = 5;
    let paymentIdCounter = 3;

    // Track assigned seats in auditorium shows to prevent double-booking
    const assignedSeats = new Map(); // showId -> Set('Row-Seat')
    assignedSeats.set(1, new Set(['O-1', 'O-2', 'B-5'])); // Already booked

    // Helper to get next free seat for auditorium
    const getNextSeat = (showId) => {
      if (!assignedSeats.has(showId)) {
        assignedSeats.set(showId, new Set());
      }
      const set = assignedSeats.get(showId);
      const rows = 'ABCDEFGHIJKLMNOPQRST'.split('');
      for (const r of rows) {
        // Leave Rows A through L completely free in Show 1 for tests and attendee booking demos
        if (showId === 1 && 'ABCDEFGHIJKL'.includes(r)) continue;
        for (let s = 1; s <= 25; s++) {
          const key = `${r}-${s}`;
          if (!set.has(key)) {
            set.add(key);
            return { row: r, seatNo: s };
          }
        }
      }
      return null;
    };

    // Attendees pool for bookings (mix of students, faculty, and guests)
    const attendeeUserIds = Array.from({ length: 55 }, (_, i) => i + 1); // User IDs 1 to 55

    // Seed bookings across shows 1 to 14 (skipping Show 3 so it keeps exactly 1 baseline ticket = 59 remaining)
    for (let showId = 1; showId <= 14; showId++) {
      if (showId === 3) continue; // Show 3 has exactly 1 active ticket (Booking 3)

      const isAuditorium = showId === 1 || showId === 2 || showId === 4;
      const numBookings = isAuditorium ? 14 : 8;

      for (let b = 0; b < numBookings; b++) {
        const bId = bookingIdCounter++;
        const userId = attendeeUserIds[(showId * 7 + b * 3) % attendeeUserIds.length];

        // Determine user type for pricing
        const userTypeRow = (await client.query('SELECT user_type FROM users WHERE user_id = $1;', [userId])).rows[0];
        const userType = userTypeRow?.user_type || 'STUDENT';

        // Stagger booking timestamps across recent history
        const minutesAgo = (14 - showId) * 120 + b * 15 + 10;
        const bookedAt = `CURRENT_TIMESTAMP - INTERVAL '${minutesAgo} minutes'`;
        const holdExpiresAt = `CURRENT_TIMESTAMP - INTERVAL '${Math.max(0, minutesAgo - 5)} minutes'`;

        // Most bookings CONFIRMED, some CANCELLED, few PENDING
        let status = 'CONFIRMED';
        if (b === numBookings - 1 && showId >= 10) {
          status = 'PENDING';
        } else if (b === 3 || b === 8) {
          status = 'CANCELLED';
        }

        // Insert booking (trigger will update total_amount as tickets are added)
        await client.query(`
          INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
          VALUES ($1, $2, $3, ${bookedAt}, ${holdExpiresAt}, $4, 0.00);
        `, [bId, userId, showId, status === 'CANCELLED' ? 'CONFIRMED' : status]); // Start as CONFIRMED if cancelled so payment triggers cleanly

        // Number of tickets per booking (1 to 3 tickets, max 6 per BR6)
        const ticketsInBooking = (b % 3) + 1;

        if (isAuditorium) {
          for (let t = 0; t < ticketsInBooking; t++) {
            const seat = getNextSeat(showId);
            if (seat) {
              const tId = ticketIdCounter++;
              await client.query(`
                INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
                VALUES ($1, $2, $3, 1, $4, $5, $6, 0.00, $7);
              `, [tId, bId, showId, seat.row, seat.seatNo, userType, status === 'PENDING' ? 'HELD' : 'ACTIVE']);
            }
          }
        } else {
          // Classroom General Admission passes (Venue id: 2, 3, or 4)
          const venueId = (showId === 3 || (showId >= 5 && showId <= 8)) ? 2 : (showId >= 9 && showId <= 11) ? 3 : 4;
          for (let t = 0; t < ticketsInBooking; t++) {
            const tId = ticketIdCounter++;
            await client.query(`
              INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
              VALUES ($1, $2, $3, $4, NULL, NULL, $5, 0.00, $6);
            `, [tId, bId, showId, venueId, userType, status === 'PENDING' ? 'HELD' : 'ACTIVE']);
          }
        }

        // Retrieve trigger-calculated total_amount
        const totalAmountRes = await client.query('SELECT total_amount FROM booking WHERE booking_id = $1;', [bId]);
        const totalAmount = parseFloat(totalAmountRes.rows[0]?.total_amount || 0);

        // Record Payment if not pending
        if (status !== 'PENDING' && totalAmount > 0) {
          const pId = paymentIdCounter++;
          const method = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING'][b % 4];
          await client.query(`
            INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
            VALUES ($1, $2, $3, $4, 'SUCCESS', $5, ${bookedAt});
          `, [pId, bId, totalAmount, method, `GATEWAY_SEED_${pId}_${bId}`]);
        }

        // If status was meant to be CANCELLED, cancel it now so BR10 cascade trigger fires
        if (status === 'CANCELLED') {
          await client.query(`UPDATE booking SET status = 'CANCELLED' WHERE booking_id = $1;`, [bId]);
        }
      }
    }

    // Reset sequences
    await client.query(`SELECT setval('booking_booking_id_seq', (SELECT MAX(booking_id) FROM booking));`);
    await client.query(`SELECT setval('ticket_ticket_id_seq', (SELECT MAX(ticket_id) FROM ticket));`);
    await client.query(`SELECT setval('payment_payment_id_seq', (SELECT MAX(payment_id) FROM payment));`);

    await client.query('COMMIT;');

    // ─────────────────────────────────────────────────────────
    // 7. RECORD COUNT SUMMARY VERIFICATION
    // ─────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('📊 DATABASE RECORD COUNTS SUMMARY');
    console.log('═'.repeat(60));

    const tables = [
      'users', 'student', 'faculty', 'guest',
      'club', 'club_manager',
      'venue', 'seat_category', 'seat',
      'event', 'show', 'show_price',
      'booking', 'ticket', 'payment'
    ];

    let grandTotal = 0;
    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*)::int AS cnt FROM "${t}";`);
      const count = res.rows[0].cnt;
      grandTotal += count;
      console.log(`  • ${t.padEnd(16)} : ${count.toString().padStart(5)} rows`);
    }

    console.log('─'.repeat(60));
    console.log(`  🎉 GRAND TOTAL    : ${grandTotal.toString().padStart(5)} records across 15 relations`);
    console.log('═'.repeat(60));
    console.log('✓ Seeding completed successfully! Course requirement (500+ records) satisfied.');

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('\n❌ Seeding failed with error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
