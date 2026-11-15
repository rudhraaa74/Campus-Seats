// ─────────────────────────────────────────────────────────────
// database/seed/generate_seed.js
// SeatSync — Enterprise-Scale Campus Event Ecosystem Generator
// Populates 3,200+ realistic records across Cultural, Technical,
// Sports, Esports, Academic, Departmental & Faculty Venues & Clubs
// ─────────────────────────────────────────────────────────────

import { pool } from '../../backend/src/db/pool.js';

// Standard bcrypt hash for password "Password123!"
const DEMO_PW_HASH = '$2a$10$eEEl6WdPPj7XsQ90Pz3P3OWqbdlADHkzMNCaxK.6DcCtnuYA.RCEa';

async function seed() {
  const client = await pool.connect();
  console.log('═'.repeat(72));
  console.log('🚀 SeatSync — Seeding Enterprise-Scale Campus Event Ecosystem (3,200+ records)');
  console.log('═'.repeat(72));

  try {
    await client.query('BEGIN;');

    // 0. Temporarily disable booking window trigger to permit historical analytics records
    await client.query('ALTER TABLE booking DISABLE TRIGGER trg_booking_window;');

    // Clean previous dynamic data cleanly
    console.log('  → Cleaning previous records...');
    await client.query('DELETE FROM payment;');
    await client.query('DELETE FROM ticket;');
    await client.query('DELETE FROM booking;');
    await client.query('DELETE FROM show_price;');
    await client.query('DELETE FROM show;');
    await client.query('DELETE FROM event;');
    await client.query('DELETE FROM club_manager;');
    await client.query('DELETE FROM club;');
    await client.query('DELETE FROM student;');
    await client.query('DELETE FROM faculty;');
    await client.query('DELETE FROM guest;');
    await client.query('DELETE FROM users;');
    await client.query('DELETE FROM seat WHERE venue_id > 1;');
    await client.query('DELETE FROM seat_category WHERE venue_id > 1;');
    await client.query('DELETE FROM venue WHERE venue_id > 1;');

    // ─────────────────────────────────────────────────────────
    // 1. CLUBS & SOCIETIES (11 Campus Clubs across all domains)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 11 Campus Clubs (Cultural, Technical, Sports, Esports, Academic, Faculty)...');
    const clubsData = [
      [1, 'Music Club', 'music.club@campus.ac.in', '9876543201', 'Official campus music society, live bands, acoustic sessions, and orchestras.'],
      [2, 'Drama Society', 'drama.soc@campus.ac.in', '9876543202', 'Campus theatre, annual stage productions, street plays, and improv comedy.'],
      [3, 'Dance Club (Tarang)', 'dance.club@campus.ac.in', '9876543203', 'Western choreography, classical Bharatanatyam/Kathak, and hip-hop dance crew.'],
      [4, 'Tech & Robotics Club', 'tech.robotics@campus.ac.in', '9876543204', 'Robotics championships, autonomous drones, AI hardware, and maker faires.'],
      [5, 'Coding & ACM Society', 'acm.coding@campus.ac.in', '9876543205', 'Competitive programming, 24-hour hackathons, algorithmic sprints, and open-source.'],
      [6, 'Cyber Security Guild', 'cyber.guild@campus.ac.in', '9876543206', 'Capture The Flag (CTF) competitions, network security, ethical hacking, and defense.'],
      [7, 'Campus Esports Guild', 'esports.guild@campus.ac.in', '9876543207', 'Inter-hostel gaming tournaments: Valorant, EA FC, Rocket League, CS2, and Fighting games.'],
      [8, 'Sports Council', 'sports.council@campus.ac.in', '9876543208', 'Inter-hostel athletics, futsal leagues, badminton tournaments, and annual sports gala.'],
      [9, 'Literary & Debating Society', 'literary.soc@campus.ac.in', '9876543209', 'Parliamentary debates, Model United Nations, poetry slams, and literary colloquiums.'],
      [10, 'CSE Department Council', 'cse.council@campus.ac.in', '9876543210', 'Computer Science student-faculty townhalls, capstone demos, and research symposiums.'],
      [11, 'Faculty Academic Senate', 'faculty.senate@campus.ac.in', '9876543211', 'Inter-departmental faculty senate meets, research colloquiums, and curriculum boards.']
    ];

    for (const c of clubsData) {
      await client.query(`
        INSERT INTO club (club_id, name, club_email, club_phone, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (club_id) DO UPDATE SET
          name = EXCLUDED.name,
          club_email = EXCLUDED.club_email,
          club_phone = EXCLUDED.club_phone,
          description = EXCLUDED.description;
      `, c);
    }
    await client.query(`SELECT setval('club_club_id_seq', (SELECT MAX(club_id) FROM club));`);

    // ─────────────────────────────────────────────────────────
    // 2. VENUES & ROOMS (8 Diverse Campus Spaces)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 8 Venues (Auditorium, Lecture Halls, Seminar Rooms, Esports Arena, Tech Lab, Board Room)...');
    const venuesData = [
      [1, 'Main Auditorium', 'AUDITORIUM', null],
      [2, 'Lecture Hall 101', 'CLASSROOM', 60],
      [3, 'Seminar Hall 202', 'CLASSROOM', 40],
      [4, 'Open Air Amphitheatre', 'CLASSROOM', 250],
      [5, 'Campus Esports Gaming Arena (Lab 301)', 'CLASSROOM', 80],
      [6, 'Tech & AI Innovation Lab', 'CLASSROOM', 50],
      [7, 'Faculty Executive Board Room', 'CLASSROOM', 25],
      [8, 'Mechanical Design & CAD Studio', 'CLASSROOM', 45]
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

    // Seat Categories:
    // Venue 1: Gold (cat 1), Silver (cat 2)
    // Venues 2-8: Exactly one category per classroom (BR4 / trg_classroom_single_category)
    const categoriesData = [
      [1, 1, 'Gold'],
      [2, 1, 'Silver'],
      [3, 2, 'General'],
      [4, 3, 'General'],
      [5, 4, 'General'],
      [6, 5, 'General'],
      [7, 6, 'General'],
      [8, 7, 'General'],
      [9, 8, 'General']
    ];

    for (const cat of categoriesData) {
      await client.query(`
        INSERT INTO seat_category (category_id, venue_id, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (category_id) DO UPDATE SET
          venue_id = EXCLUDED.venue_id,
          name = EXCLUDED.name;
      `, cat);
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
    // 3. USERS & DEDICATED MANAGERS (Multiple Logins)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 120+ Users with Dedicated Logins for every Club Manager...');

    // Baseline Core Users:
    // User 1: manager@seatsync.ac.in (Music Club Admin)
    // User 2: student1@seatsync.ac.in (Student)
    // User 3: student2@seatsync.ac.in (Student)
    // User 4: faculty@seatsync.ac.in (Faculty)
    // User 5: guest1@gmail.com (Guest)
    const coreUsers = [
      { id: 1, email: 'manager@seatsync.ac.in', first: 'Pranay', last: 'Pratyush', phone: '9876543210', type: 'STUDENT', roll: '2023B5AA1211H', year: 3, clubRole: { clubId: 1, role: 'ADMIN' } },
      { id: 2, email: 'student1@seatsync.ac.in', first: 'Rudhra', last: 'Koul', phone: '9876543211', type: 'STUDENT', roll: '2023B3AD0445H', year: 3 },
      { id: 3, email: 'student2@seatsync.ac.in', first: 'Areesha', last: 'Shahid', phone: '9876543212', type: 'STUDENT', roll: '2023B1A40991H', year: 3 },
      { id: 4, email: 'faculty@seatsync.ac.in', first: 'Dr. Ramesh', last: 'Sharma', phone: '9876543213', type: 'FACULTY', empId: 'FAC_CS_101', dept: 'Computer Science' },
      { id: 5, email: 'guest1@gmail.com', first: 'John', last: 'Doe', phone: '9876543214', type: 'GUEST', aff: 'BITS Alumni Network' },

      // Additional Department / Club Managers
      { id: 6, email: 'manager.drama@seatsync.ac.in', first: 'Harshitha', last: 'Ambavarapu', phone: '9876543215', type: 'STUDENT', roll: '2023B2AD0873H', year: 3, clubRole: { clubId: 2, role: 'ADMIN' } },
      { id: 7, email: 'manager.dance@seatsync.ac.in', first: 'Ananya', last: 'Iyer', phone: '9876543216', type: 'STUDENT', roll: '2023B1A40555H', year: 3, clubRole: { clubId: 3, role: 'ADMIN' } },
      { id: 8, email: 'manager.tech@seatsync.ac.in', first: 'Geetanjali', last: 'Dangeti', phone: '9876543217', type: 'STUDENT', roll: '2023B4AD0609H', year: 3, clubRole: { clubId: 4, role: 'ADMIN' } },
      { id: 9, email: 'manager.coding@seatsync.ac.in', first: 'Aarav', last: 'Sharma', phone: '9876543218', type: 'STUDENT', roll: '2022A7PS0042H', year: 4, clubRole: { clubId: 5, role: 'ADMIN' } },
      { id: 10, email: 'manager.cyber@seatsync.ac.in', first: 'Kabir', last: 'Sen', phone: '9876543219', type: 'STUDENT', roll: '2023B3A70231H', year: 3, clubRole: { clubId: 6, role: 'ADMIN' } },
      { id: 11, email: 'manager.esports@seatsync.ac.in', first: 'Rohan', last: 'Reddy', phone: '9876543220', type: 'STUDENT', roll: '2023A3PS0119H', year: 3, clubRole: { clubId: 7, role: 'ADMIN' } },
      { id: 12, email: 'manager.sports@seatsync.ac.in', first: 'Sunil', last: 'Chhetri', phone: '9876543221', type: 'STUDENT', roll: '2022A7PS0012H', year: 4, clubRole: { clubId: 8, role: 'ADMIN' } },
      { id: 13, email: 'manager.lit@seatsync.ac.in', first: 'Vikram', last: 'Seth', phone: '9876543222', type: 'FACULTY', empId: 'FAC_HUM_202', dept: 'Humanities & Social Sciences', clubRole: { clubId: 9, role: 'ADMIN' } },
      { id: 14, email: 'manager.cse@seatsync.ac.in', first: 'Sneha', last: 'Patel', phone: '9876543223', type: 'STUDENT', roll: '2023A7PS0404H', year: 3, clubRole: { clubId: 10, role: 'ADMIN' } },
      { id: 15, email: 'manager.faculty@seatsync.ac.in', first: 'Dr. Arvind', last: 'Swamy', phone: '9876543224', type: 'FACULTY', empId: 'FAC_CS_102', dept: 'Computer Science', clubRole: { clubId: 11, role: 'ADMIN' } }
    ];

    for (const u of coreUsers) {
      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          user_type = EXCLUDED.user_type,
          verified_at = CURRENT_TIMESTAMP;
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
          ON CONFLICT (user_id, club_id) DO UPDATE SET role = EXCLUDED.role;
        `, [u.id, u.clubRole.clubId, u.clubRole.role]);
      }
    }

    // Bulk 65 Students
    const studentFirstNames = ['Aditya', 'Diya', 'Kunal', 'Pooja', 'Tanmay', 'Meera', 'Dhruv', 'Riya', 'Arjun', 'Sanjana', 'Manish', 'Neha', 'Varun', 'Kriti', 'Harsh', 'Simran', 'Akash', 'Shruti', 'Nikhil', 'Tanvi', 'Abhishek', 'Sakshi', 'Gaurav', 'Payal', 'Siddharth', 'Pallavi', 'Yash', 'Anushka', 'Vivek', 'Nandini', 'Ishaan', 'Shreya', 'Karthik', 'Bhavna', 'Mayank', 'Tara', 'Samar', 'Deepika', 'Rahul', 'Alia', 'Dev', 'Tanya', 'Ayush', 'Sanya', 'Pranav', 'Riddhi', 'Karan', 'Jahnavi', 'Kush', 'Divya', 'Anmol', 'Kritika', 'Suraj', 'Monika', 'Rajesh', 'Preeti', 'Deepak', 'Garima', 'Saurabh', 'Komal', 'Ashish', 'Bhoomi', 'Pawan', 'Twinkle', 'Naveen'];
    const studentLastNames = ['Patel', 'Reddy', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Bhatia', 'Joshi', 'Chauhan', 'Saxena', 'Mehta', 'Kaur', 'Das', 'Pandey', 'Mishra'];

    let nextUserId = 16;
    for (let i = 0; i < studentFirstNames.length; i++) {
      const uid = nextUserId++;
      const first = studentFirstNames[i];
      const last = studentLastNames[i % studentLastNames.length];
      const email = `student.${uid}@campus.ac.in`;
      const roll = `2024B${(i % 5) + 1}AA${(100 + i).toString()}H`;
      const year = (i % 4) + 1;

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'STUDENT', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, email, DEMO_PW_HASH, first, last, `981100${1000 + uid}`]);

      await client.query(`
        INSERT INTO student (user_id, roll_no, year_of_study)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, roll, year]);
    }

    // Bulk 20 Faculty
    const facultyDepts = ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Physics', 'Mathematics', 'Humanities', 'Biological Sciences', 'Chemical Engineering'];
    for (let i = 0; i < 20; i++) {
      const uid = nextUserId++;
      const first = ['Dr. Sunita', 'Dr. Mohan', 'Dr. Kavita', 'Dr. Deepak', 'Dr. Swati', 'Dr. Alok', 'Dr. Meenakshi', 'Dr. Tarun', 'Dr. Nalini', 'Dr. Jayant', 'Dr. Archana', 'Dr. Sanjay', 'Dr. Rashmi', 'Dr. Sudhir', 'Dr. Rekha', 'Dr. Sandeep', 'Dr. Anjali', 'Dr. Vijay', 'Dr. Parul', 'Dr. Harish'][i];
      const last = studentLastNames[(i + 3) % studentLastNames.length];
      const email = `faculty.${uid}@campus.ac.in`;
      const empId = `FAC_DEPT_${200 + i}`;
      const dept = facultyDepts[i % facultyDepts.length];

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'FACULTY', CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, email, DEMO_PW_HASH, first, last, `982200${1000 + uid}`]);

      await client.query(`
        INSERT INTO faculty (user_id, employee_id, department)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING;
      `, [uid, empId, dept]);
    }

    // Bulk 20 Guests
    const guestAffiliations = ['BITS Alumni Association', 'Delhi University', 'IIT Hyderabad', 'Visiting Parent', 'Industry Partner (Google)', 'Cultural Delegate', 'Press & Media', 'Tech Speaker (Microsoft)', 'TCS Innovation Labs', 'ISRO Guest Researcher'];
    for (let i = 0; i < 20; i++) {
      const uid = nextUserId++;
      const first = ['Robert', 'Emily', 'David', 'Sarah', 'Michael', 'Jessica', 'Thomas', 'Laura', 'James', 'Rachel', 'Brian', 'Claire', 'Daniel', 'Emma', 'George', 'Rebecca', 'Simon', 'Grace', 'Henry', 'Olivia'][i];
      const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'White', 'Harris', 'Martin', 'Clark', 'Lewis', 'Walker', 'Young', 'Allen', 'King', 'Wright'][i];
      const email = `guest.${uid}@external.org`;
      const aff = guestAffiliations[i % guestAffiliations.length];

      await client.query(`
        INSERT INTO users (user_id, email, password_hash, first_name, last_name, phone, user_type, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'GUEST', CURRENT_TIMESTAMP)
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
    // 4. EVENTS (18 Campus Events across Clubs)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 18 Diverse Campus Events across all Clubs...');
    const eventsData = [
      [1, 1, 'Campus Rock Night 2026', 'CULTURAL', 180, 'Annual rock concert featuring campus headliners and visiting indie bands.'],
      [2, 2, 'The Tempest: Annual Production', 'CULTURAL', 120, "A modern proscenium theatrical adaptation of Shakespeare's The Tempest."],
      [3, 1, 'Acoustic Unplugged', 'CULTURAL', 90, 'An intimate evening of acoustic music in a classroom setting.'],
      [4, 3, 'Tarang: Inter-College Dance Fiesta', 'CULTURAL', 150, 'High-energy western choreography, classical jugalbandi, and hip-hop showdown.'],
      [5, 2, 'Standup Comedy Campus Open Mic', 'CULTURAL', 90, 'Campus comic stars and guest standup artists live on stage.'],
      [6, 5, 'CodeSprint 2026: 24h Hackathon', 'TECHNICAL', 180, 'Flagship campus hackathon: build AI, web3, and cloud products overnight.'],
      [7, 4, 'RoboWars & Autonomous Drone Grand Prix', 'TECHNICAL', 180, 'Autonomous bot navigation, obstacle courses, combat bots, and drone racing.'],
      [8, 6, 'CyberWar: Capture The Flag & Live Attack', 'TECHNICAL', 180, 'Hands-on jeopardy-style CTF: web exploitation, forensics, and binary reverse-engineering.'],
      [9, 4, 'Generative AI & Agentic Systems Symposium', 'TECHNICAL', 120, 'Keynotes and demos on multimodal LLMs, agentic swarms, and robotics research.'],
      [10, 7, 'Valorant Campus Masters 2026', 'SPORTS', 240, 'Premier 5v5 tactical shooter LAN tournament with live shoutcasting on big screens.'],
      [11, 7, 'EA FC 26 & Rocket League Campus Showdown', 'SPORTS', 180, '1v1 EA Sports FC console finals and 3v3 Rocket League aerial showdown.'],
      [12, 8, 'Inter-Hostel Futsal Super League Finale', 'SPORTS', 120, 'High-octane five-a-side futsal tournament finale and trophy presentation.'],
      [13, 8, 'Annual Campus Sports Awards Gala', 'CULTURAL', 150, 'Annual awards night celebrating inter-university champions, athletes, and coaches.'],
      [14, 9, 'National Parliamentary Debate Invitational', 'ACADEMIC', 150, 'Premier Asian Parliamentary format inter-university debate championship.'],
      [15, 10, 'CSE Student-Faculty Townhall & Demo Day', 'ACADEMIC', 120, 'Dialogue between CS department faculty, students, and capstone project exhibits.'],
      [16, 11, 'Faculty Academic Senate & Research Colloquium', 'ACADEMIC', 120, 'Closed-door faculty academic assembly and peer-reviewed grant research presentations.'],
      [17, 1, 'Classical Hindustani Sitar & Tabla Baithak', 'CULTURAL', 120, 'Evening of serene classical ragas, sitar improvisations, and tabla solos.'],
      [18, 4, 'Robotics & CAD Hardware Prototyping Sprint', 'TECHNICAL', 180, 'Hands-on 3D printing, circuit etching, and CAD design sprint for makers.']
    ];

    for (const ev of eventsData) {
      await client.query(`
        INSERT INTO event (event_id, club_id, title, event_type, duration_min, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO UPDATE SET
          club_id = EXCLUDED.club_id,
          title = EXCLUDED.title,
          event_type = EXCLUDED.event_type,
          duration_min = EXCLUDED.duration_min,
          description = EXCLUDED.description;
      `, ev);
    }
    await client.query(`SELECT setval('event_event_id_seq', (SELECT MAX(event_id) FROM event));`);

    // ─────────────────────────────────────────────────────────
    // 5. SHOWS (36 Strictly Non-Overlapping Shows across 8 Venues)
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding 36 Shows (Historical Analytics + Live Bookable Shows + Unbooked Free Shows)...');

    // Shows 1, 2, 3 correspond to the official baseline:
    // Show 1: Venue 1 (Auditorium), Show 2: Venue 1 (Auditorium), Show 3: Venue 2 (Classroom, cap 60)
    // Show 1 and Show 3 are set to upcoming timestamps (future) so live booking tests pass cleanly!
    const showsData = [
      // ── Main Auditorium (Venue 1) ──────────────────────────
      [1, 1, 1, "CURRENT_TIMESTAMP + INTERVAL '1 day 6 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 9 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Show 1 upcoming!
      [2, 2, 1, "CURRENT_TIMESTAMP + INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 6.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Show 2 upcoming!
      [4, 13, 1, "CURRENT_TIMESTAMP - INTERVAL '1 day 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '1 day 1.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Historical analytics show
      [5, 1, 1, "CURRENT_TIMESTAMP - INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 1 hour'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Historical analytics show
      // Unbooked / Free Shows (for Query 4 / Tab 4 in Reports):
      [6, 9, 1, "CURRENT_TIMESTAMP + INTERVAL '3 days 2 hours'", "CURRENT_TIMESTAMP + INTERVAL '3 days 4 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Tech Club unbooked
      [7, 13, 1, "CURRENT_TIMESTAMP + INTERVAL '4 days 6 hours'", "CURRENT_TIMESTAMP + INTERVAL '4 days 8.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Sports Council unbooked
      [8, 4, 1, "CURRENT_TIMESTAMP + INTERVAL '5 days 5 hours'", "CURRENT_TIMESTAMP + INTERVAL '5 days 7.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Dance Club unbooked

      // ── Lecture Hall 101 (Venue 2, cap 60) ─────────────────
      [3, 3, 2, "CURRENT_TIMESTAMP + INTERVAL '1 day 2 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 4 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Baseline Show 3 classroom!
      [9, 5, 2, "CURRENT_TIMESTAMP - INTERVAL '3 days 3 hours'", "CURRENT_TIMESTAMP - INTERVAL '3 days 1.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [10, 8, 2, "CURRENT_TIMESTAMP - INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 1 hour'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [11, 15, 2, "CURRENT_TIMESTAMP - INTERVAL '1 day 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '1 day 2 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY']], // Dept Townhall
      [12, 8, 2, "CURRENT_TIMESTAMP + INTERVAL '2 days 3 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 6 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [13, 5, 2, "CURRENT_TIMESTAMP + INTERVAL '3 days 3 hours'", "CURRENT_TIMESTAMP + INTERVAL '3 days 4.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Drama Soc unbooked
      [14, 15, 2, "CURRENT_TIMESTAMP + INTERVAL '4 days 4 hours'", "CURRENT_TIMESTAMP + INTERVAL '4 days 6 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY']], // CSE Council unbooked

      // ── Seminar Hall 202 (Venue 3, cap 40) ─────────────────
      [15, 3, 3, "CURRENT_TIMESTAMP - INTERVAL '3 days 2 hours'", "CURRENT_TIMESTAMP - INTERVAL '3 days 0.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [16, 14, 3, "CURRENT_TIMESTAMP - INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 1.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [17, 17, 3, "CURRENT_TIMESTAMP - INTERVAL '1 day 3 hours'", "CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [18, 3, 3, "CURRENT_TIMESTAMP + INTERVAL '1 day 6 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 7.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Music Club unbooked
      [19, 14, 3, "CURRENT_TIMESTAMP + INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 6.5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Literary Soc unbooked
      [20, 17, 3, "CURRENT_TIMESTAMP + INTERVAL '3 days 5 hours'", "CURRENT_TIMESTAMP + INTERVAL '3 days 7 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],

      // ── Open Air Amphitheatre (Venue 4, cap 250) ───────────
      [21, 7, 4, "CURRENT_TIMESTAMP - INTERVAL '3 days 5 hours'", "CURRENT_TIMESTAMP - INTERVAL '3 days 2 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [22, 12, 4, "CURRENT_TIMESTAMP - INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 2 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [23, 7, 4, "CURRENT_TIMESTAMP + INTERVAL '1 day 4 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 7 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [24, 12, 4, "CURRENT_TIMESTAMP + INTERVAL '2 days 5 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 7 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],

      // ── Campus Esports Arena Lab 301 (Venue 5, cap 80) ─────
      [25, 10, 5, "CURRENT_TIMESTAMP - INTERVAL '3 days 6 hours'", "CURRENT_TIMESTAMP - INTERVAL '3 days 2 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [26, 11, 5, "CURRENT_TIMESTAMP - INTERVAL '2 days 5 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 2 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [27, 10, 5, "CURRENT_TIMESTAMP + INTERVAL '1 day 3 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 7 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [28, 11, 5, "CURRENT_TIMESTAMP + INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 7 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Esports Guild unbooked

      // ── Tech & AI Innovation Lab (Venue 6, cap 50) ──────────
      [29, 6, 6, "CURRENT_TIMESTAMP - INTERVAL '2 days 8 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [30, 6, 6, "CURRENT_TIMESTAMP + INTERVAL '1 day 2 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [31, 6, 6, "CURRENT_TIMESTAMP + INTERVAL '3 days 2 hours'", "CURRENT_TIMESTAMP + INTERVAL '3 days 5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']], // Coding Soc unbooked

      // ── Faculty Executive Board Room (Venue 7, cap 25) ─────
      [32, 16, 7, "CURRENT_TIMESTAMP - INTERVAL '2 days 3 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 1 hour'", 'SCHEDULED', ['FACULTY']], // Faculty Exclusive!
      [33, 16, 7, "CURRENT_TIMESTAMP + INTERVAL '1 day 3 hours'", "CURRENT_TIMESTAMP + INTERVAL '1 day 5 hours'", 'SCHEDULED', ['FACULTY']], // Faculty Exclusive!
      [34, 16, 7, "CURRENT_TIMESTAMP + INTERVAL '3 days 3 hours'", "CURRENT_TIMESTAMP + INTERVAL '3 days 5 hours'", 'SCHEDULED', ['FACULTY']], // Faculty Senate unbooked

      // ── Mechanical Design & CAD Studio (Venue 8, cap 45) ────
      [35, 18, 8, "CURRENT_TIMESTAMP - INTERVAL '2 days 4 hours'", "CURRENT_TIMESTAMP - INTERVAL '2 days 1 hour'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']],
      [36, 18, 8, "CURRENT_TIMESTAMP + INTERVAL '2 days 2 hours'", "CURRENT_TIMESTAMP + INTERVAL '2 days 5 hours'", 'SCHEDULED', ['STUDENT', 'FACULTY', 'GUEST']] // Tech Club unbooked
    ];

    for (const s of showsData) {
      await client.query(`
        INSERT INTO show (show_id, event_id, venue_id, start_time, end_time, status, allowed_attendees)
        VALUES ($1, $2, $3, ${s[3]}, ${s[4]}, $4, $5)
        ON CONFLICT (show_id) DO UPDATE SET
          event_id = EXCLUDED.event_id,
          venue_id = EXCLUDED.venue_id,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status,
          allowed_attendees = EXCLUDED.allowed_attendees;
      `, [s[0], s[1], s[2], s[5], s[6]]);
    }
    await client.query(`SELECT setval('show_show_id_seq', (SELECT MAX(show_id) FROM show));`);

    // ─────────────────────────────────────────────────────────
    // 6. SHOW PRICING MATRICES
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding Show Pricing Matrices for all 36 Shows...');

    // Auditorium shows: Cat 1 (Gold) and Cat 2 (Silver)
    for (const showId of [1, 2, 4, 5, 6, 7, 8]) {
      await client.query(`
        INSERT INTO show_price (show_id, category_id, user_type, price)
        VALUES
          ($1, 1, 'STUDENT', 100.00), ($1, 1, 'FACULTY', 150.00), ($1, 1, 'GUEST', 250.00),
          ($1, 2, 'STUDENT', 60.00),  ($1, 2, 'FACULTY', 100.00), ($1, 2, 'GUEST', 150.00)
        ON CONFLICT (show_id, category_id, user_type) DO UPDATE SET price = EXCLUDED.price;
      `, [showId]);
    }

    // Classroom Venues: map showId to venue category
    const classroomVenueCategory = {
      // Lecture Hall 101 (Venue 2 -> Cat 3)
      3: { cat: 3, student: 20, faculty: 50, guest: 80 },
      9: { cat: 3, student: 30, faculty: 50, guest: 80 },
      10: { cat: 3, student: 30, faculty: 50, guest: 80 },
      11: { cat: 3, student: 20, faculty: 40, guest: 60 },
      12: { cat: 3, student: 30, faculty: 50, guest: 80 },
      13: { cat: 3, student: 30, faculty: 50, guest: 80 },
      14: { cat: 3, student: 20, faculty: 40, guest: 60 },

      // Seminar Hall 202 (Venue 3 -> Cat 4)
      15: { cat: 4, student: 25, faculty: 40, guest: 70 },
      16: { cat: 4, student: 25, faculty: 40, guest: 70 },
      17: { cat: 4, student: 30, faculty: 50, guest: 80 },
      18: { cat: 4, student: 25, faculty: 40, guest: 70 },
      19: { cat: 4, student: 25, faculty: 40, guest: 70 },
      20: { cat: 4, student: 30, faculty: 50, guest: 80 },

      // Open Air Amphitheatre (Venue 4 -> Cat 5)
      21: { cat: 5, student: 50, faculty: 80, guest: 120 },
      22: { cat: 5, student: 50, faculty: 80, guest: 120 },
      23: { cat: 5, student: 50, faculty: 80, guest: 120 },
      24: { cat: 5, student: 50, faculty: 80, guest: 120 },

      // Esports Arena Lab 301 (Venue 5 -> Cat 6)
      25: { cat: 6, student: 40, faculty: 60, guest: 100 },
      26: { cat: 6, student: 40, faculty: 60, guest: 100 },
      27: { cat: 6, student: 40, faculty: 60, guest: 100 },
      28: { cat: 6, student: 40, faculty: 60, guest: 100 },

      // Tech Lab (Venue 6 -> Cat 7)
      29: { cat: 7, student: 50, faculty: 80, guest: 120 },
      30: { cat: 7, student: 50, faculty: 80, guest: 120 },
      31: { cat: 7, student: 50, faculty: 80, guest: 120 },

      // Faculty Board Room (Venue 7 -> Cat 8)
      32: { cat: 8, student: 0, faculty: 20, guest: 50 },
      33: { cat: 8, student: 0, faculty: 20, guest: 50 },
      34: { cat: 8, student: 0, faculty: 20, guest: 50 },

      // CAD Studio (Venue 8 -> Cat 9)
      35: { cat: 9, student: 30, faculty: 50, guest: 80 },
      36: { cat: 9, student: 30, faculty: 50, guest: 80 }
    };

    for (const [sId, cfg] of Object.entries(classroomVenueCategory)) {
      await client.query(`
        INSERT INTO show_price (show_id, category_id, user_type, price)
        VALUES
          ($1, $2, 'STUDENT', $3),
          ($1, $2, 'FACULTY', $4),
          ($1, $2, 'GUEST', $5)
        ON CONFLICT (show_id, category_id, user_type) DO UPDATE SET price = EXCLUDED.price;
      `, [parseInt(sId, 10), cfg.cat, cfg.student, cfg.faculty, cfg.guest]);
    }

    // ─────────────────────────────────────────────────────────
    // 7. HIGH-VOLUME BOOKINGS, TICKETS & PAYMENTS
    // ─────────────────────────────────────────────────────────
    console.log('  → Seeding Baseline Bookings + High-Volume Bulk Analytics Data...');

    // Baseline Bookings 1, 2, 3 required by test suite:
    // Booking 1: Rudhra (user 2, STUDENT) for Show 1 (Seats O-1 STUDENT: 100, O-2 STUDENT: 100 = 200)
    await client.query(`
      INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
      VALUES (1, 2, 1, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '55 minutes', 'CONFIRMED', 200.00);
    `);
    await client.query(`
      INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES
        (1, 1, 1, 1, 'O', 1, 'STUDENT', 100.00, 'ACTIVE'),
        (2, 1, 1, 1, 'O', 2, 'STUDENT', 100.00, 'ACTIVE');
    `);
    await client.query(`
      INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
      VALUES (1, 1, 200.00, 'UPI', 'SUCCESS', 'DEMO_PAY_001', CURRENT_TIMESTAMP - INTERVAL '58 minutes');
    `);

    // Booking 2: Areesha (user 3) for Show 1 (Seat B-5 STUDENT: 60, HELD)
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

    // Shows that MUST REMAIN UNBOOKED (0 tickets) so Query 4 (NOT EXISTS) has rich data for all managers!
    const unbookedShowIds = new Set([6, 7, 8, 13, 14, 18, 19, 28, 31, 34, 36]);

    // Track assigned seats in auditorium shows to prevent double-booking
    const assignedSeats = new Map();
    // Show 1 baseline: O-1, O-2, B-5 already assigned
    assignedSeats.set(1, new Set(['O-1', 'O-2', 'B-5']));

    const getNextSeat = (showId) => {
      if (!assignedSeats.has(showId)) assignedSeats.set(showId, new Set());
      const set = assignedSeats.get(showId);
      const rows = 'ABCDEFGHIJKLMNOPQRST'.split('');
      for (const r of rows) {
        // In Show 1: Keep Rows A, B, C, D, E completely free for test suite (A-1, B-20, C-10, C-11, E-1..3)!
        if (showId === 1 && 'ABCDE'.includes(r)) continue;
        // In Show 2: Keep Rows A, B, C free
        if (showId === 2 && 'ABC'.includes(r)) continue;
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

    // Attendee user pool
    const allUsers = (await client.query('SELECT user_id, user_type FROM users ORDER BY user_id ASC;')).rows;
    const studentUsers = allUsers.filter(u => u.user_type === 'STUDENT').map(u => u.user_id);
    const facultyUsers = allUsers.filter(u => u.user_type === 'FACULTY').map(u => u.user_id);
    const guestUsers = allUsers.filter(u => u.user_type === 'GUEST').map(u => u.user_id);

    // Seed bookings across shows 1 to 36 (skipping Show 3 so it keeps exactly 1 ticket, and unbooked shows)
    for (let showId = 1; showId <= 36; showId++) {
      if (showId === 3 || unbookedShowIds.has(showId)) {
        continue;
      }

      const showRow = showsData.find(s => s[0] === showId);
      const venueId = showRow[2];
      const isAuditorium = venueId === 1;
      const isFacultyExclusive = showRow[6].length === 1 && showRow[6][0] === 'FACULTY';

      // Determine target bookings per show:
      let targetBookings = 0;
      if (isAuditorium) {
        targetBookings = showId === 1 ? 16 : showId <= 5 ? 36 : 20;
      } else if (venueId === 4) { // Amphitheatre (cap 250)
        targetBookings = showId <= 22 ? 40 : 22;
      } else if (venueId === 5) { // Esports Arena (cap 80)
        targetBookings = showId <= 26 ? 26 : 14;
      } else if (venueId === 6) { // Tech Lab (cap 50)
        targetBookings = showId === 29 ? 20 : 12;
      } else if (venueId === 7) { // Faculty Board Room (cap 25)
        targetBookings = 10;
      } else { // Lecture Hall (cap 60) & Seminar Hall (cap 40)
        targetBookings = venueId === 2 ? 20 : 15;
      }

      for (let b = 0; b < targetBookings; b++) {
        const bId = bookingIdCounter++;
        let userId;

        if (isFacultyExclusive) {
          userId = facultyUsers[b % facultyUsers.length];
        } else {
          // Mix: 70% Students, 20% Faculty, 10% Guests
          if (b % 5 === 4) {
            userId = guestUsers[b % guestUsers.length];
          } else if (b % 5 === 3) {
            userId = facultyUsers[b % facultyUsers.length];
          } else {
            userId = studentUsers[(showId * 7 + b * 3) % studentUsers.length];
          }
        }

        const userObj = allUsers.find(u => u.user_id === userId);
        const attendeeType = userObj?.user_type || 'STUDENT';

        // Timing
        const isPastShow = [4, 5, 9, 10, 11, 15, 16, 17, 21, 22, 25, 26, 29, 32, 35].includes(showId);
        const minutesAgo = isPastShow ? (1400 + b * 20) : (60 + b * 10);
        const bookedAt = `CURRENT_TIMESTAMP - INTERVAL '${minutesAgo} minutes'`;
        const holdExpiresAt = `CURRENT_TIMESTAMP - INTERVAL '${Math.max(0, minutesAgo - 5)} minutes'`;

        // Status: 88% CONFIRMED, 8% PENDING (for held seats analytics), 4% CANCELLED
        let status = 'CONFIRMED';
        if (b === targetBookings - 1 && !isPastShow) {
          status = 'PENDING';
        } else if (b === 4 && isPastShow) {
          status = 'CANCELLED';
        }

        await client.query(`
          INSERT INTO booking (booking_id, user_id, show_id, booked_at, hold_expires_at, status, total_amount)
          VALUES ($1, $2, $3, ${bookedAt}, ${holdExpiresAt}, $4, 0.00);
        `, [bId, userId, showId, status === 'CANCELLED' ? 'CONFIRMED' : status]);

        // Tickets per booking (1 to 3 tickets)
        const ticketsInBooking = isAuditorium ? ((b % 3) + 1) : ((b % 2) + 1);

        if (isAuditorium) {
          for (let t = 0; t < ticketsInBooking; t++) {
            const seat = getNextSeat(showId);
            if (seat) {
              const tId = ticketIdCounter++;
              await client.query(`
                INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
                VALUES ($1, $2, $3, 1, $4, $5, $6, 0.00, $7);
              `, [tId, bId, showId, seat.row, seat.seatNo, attendeeType, status === 'PENDING' ? 'HELD' : 'ACTIVE']);
            }
          }
        } else {
          for (let t = 0; t < ticketsInBooking; t++) {
            const tId = ticketIdCounter++;
            await client.query(`
              INSERT INTO ticket (ticket_id, booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
              VALUES ($1, $2, $3, $4, NULL, NULL, $5, 0.00, $6);
            `, [tId, bId, showId, venueId, attendeeType, status === 'PENDING' ? 'HELD' : 'ACTIVE']);
          }
        }

        // Get trigger-calculated total amount
        const totalRes = await client.query('SELECT total_amount FROM booking WHERE booking_id = $1;', [bId]);
        const totalAmount = parseFloat(totalRes.rows[0]?.total_amount || 0);

        // Record payment for confirmed bookings
        if (status !== 'PENDING' && totalAmount > 0) {
          const pId = paymentIdCounter++;
          const method = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING'][b % 4];
          await client.query(`
            INSERT INTO payment (payment_id, booking_id, amount, payment_method, status, gateway_ref, paid_at)
            VALUES ($1, $2, $3, $4, 'SUCCESS', $5, ${bookedAt});
          `, [pId, bId, totalAmount, method, `GATEWAY_SEED_${pId}_${bId}`]);
        }

        // If meant to be CANCELLED, cancel it now to test cascade triggers
        if (status === 'CANCELLED') {
          await client.query(`UPDATE booking SET status = 'CANCELLED' WHERE booking_id = $1;`, [bId]);
        }
      }
    }

    // Reset sequences
    await client.query(`SELECT setval('booking_booking_id_seq', (SELECT MAX(booking_id) FROM booking));`);
    await client.query(`SELECT setval('ticket_ticket_id_seq', (SELECT MAX(ticket_id) FROM ticket));`);
    await client.query(`SELECT setval('payment_payment_id_seq', (SELECT MAX(payment_id) FROM payment));`);

    // 8. Re-enable booking window trigger
    await client.query('ALTER TABLE booking ENABLE TRIGGER trg_booking_window;');

    await client.query('COMMIT;');

    // ─────────────────────────────────────────────────────────
    // 9. RECORD COUNT SUMMARY VERIFICATION
    // ─────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(72));
    console.log('📊 DATABASE RECORD COUNTS SUMMARY');
    console.log('═'.repeat(72));

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

    console.log('─'.repeat(72));
    console.log(`  🎉 GRAND TOTAL    : ${grandTotal.toString().padStart(5)} records across all 15 relations`);
    console.log('═'.repeat(72));
    console.log('✓ Seeding completed successfully! Enterprise campus ecosystem populated.');

  } catch (err) {
    await client.query('ROLLBACK;');
    try {
      await client.query('ALTER TABLE booking ENABLE TRIGGER trg_booking_window;');
    } catch (_) {}
    console.error('\n❌ Seeding failed with error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
