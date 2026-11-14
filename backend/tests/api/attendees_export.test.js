// ─────────────────────────────────────────────────────────────
// backend/tests/api/attendees_export.test.js
// Integration and unit tests for "Export attendee list (CSV)"
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { env } from '../../src/config/env.js';
import {
  isWhitelistedPhone,
  neutralizeField,
  escapeField,
  formatRow,
  buildAttendeesCsv,
} from '../../src/utils/csv.js';

describe('Export Attendee List (CSV) API & CSV Helpers', () => {
  let managerToken = '';
  let otherClubManagerToken = '';
  let studentToken = '';

  let eventId = null;
  let show1Id = null;
  let show2Id = null;
  let otherEventShowId = null;

  const testRunId = Date.now();

  const cleanupTestData = async () => {
    try {
      await pool.query(`
        DELETE FROM payment WHERE booking_id IN (
          SELECT booking_id FROM booking WHERE show_id IN (
            SELECT show_id FROM show WHERE event_id IN (
              SELECT event_id FROM event WHERE title LIKE 'ATT_TEST_%'
            )
          )
        );
      `);
      await pool.query(`
        DELETE FROM ticket WHERE show_id IN (
          SELECT show_id FROM show WHERE event_id IN (
            SELECT event_id FROM event WHERE title LIKE 'ATT_TEST_%'
          )
        );
      `);
      await pool.query(`
        DELETE FROM booking WHERE show_id IN (
          SELECT show_id FROM show WHERE event_id IN (
            SELECT event_id FROM event WHERE title LIKE 'ATT_TEST_%'
          )
        );
      `);
      await pool.query(`
        DELETE FROM show_price WHERE show_id IN (
          SELECT show_id FROM show WHERE event_id IN (
            SELECT event_id FROM event WHERE title LIKE 'ATT_TEST_%'
          )
        );
      `);
      await pool.query(`
        DELETE FROM show WHERE event_id IN (
          SELECT event_id FROM event WHERE title LIKE 'ATT_TEST_%'
        );
      `);
      await pool.query(`
        DELETE FROM event WHERE title LIKE 'ATT_TEST_%';
      `);
      await pool.query(`
        DELETE FROM student WHERE user_id IN (
          SELECT user_id FROM users WHERE email LIKE 'att_%@seatsync.ac.in'
        );
      `);
      await pool.query(`
        DELETE FROM users WHERE email LIKE 'att_%@seatsync.ac.in';
      `);
    } catch (e) {
      // ignore
    }
  };

  beforeAll(async () => {
    await cleanupTestData();

    // 1. Authorized manager for Club 1 (Music Club)
    const managerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager@seatsync.ac.in',
        password: 'Password123!',
      });
    managerToken = managerLogin.body.token;

    // 2. Manager of a DIFFERENT club (Club 2) via signed JWT
    otherClubManagerToken = jwt.sign(
      { userId: 9999, userType: 'STUDENT', clubIds: [2] },
      env.jwt.secret
    );

    // 3. Regular student attendee (not a manager)
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student1@seatsync.ac.in',
        password: 'Password123!',
      });
    studentToken = studentLogin.body.token;

    // 4. Create an event owned by Club 1
    const eventRes = await pool.query(`
      INSERT INTO event (club_id, title, event_type, duration_min, description)
      VALUES (1, 'ATT_TEST_Festival_${testRunId}', 'CULTURAL', 120, 'Test event for CSV export')
      RETURNING event_id;
    `);
    eventId = eventRes.rows[0].event_id;

    // 5. Create two shows for this event:
    // Show 1: Main Auditorium (Auditorium venue 1)
    const now = new Date();
    const show1Start = new Date(now.getTime() + 86400000);
    const show1End = new Date(show1Start.getTime() + 7200000);
    const show1Res = await pool.query(`
      INSERT INTO show (event_id, venue_id, start_time, end_time, status)
      VALUES ($1, 1, $2, $3, 'SCHEDULED')
      RETURNING show_id;
    `, [eventId, show1Start.toISOString(), show1End.toISOString()]);
    show1Id = show1Res.rows[0].show_id;

    // Show 2: Lecture Hall 101 (Classroom venue 2)
    const show2Start = new Date(show1Start.getTime() + 86400000);
    const show2End = new Date(show2Start.getTime() + 7200000);
    const show2Res = await pool.query(`
      INSERT INTO show (event_id, venue_id, start_time, end_time, status)
      VALUES ($1, 2, $2, $3, 'SCHEDULED')
      RETURNING show_id;
    `, [eventId, show2Start.toISOString(), show2End.toISOString()]);
    show2Id = show2Res.rows[0].show_id;

    // Configure show_price records so ticket creation triggers pass
    await pool.query(`
      INSERT INTO show_price (show_id, category_id, user_type, price)
      SELECT $1, sc.category_id, ut.user_type, 150.00
      FROM seat_category sc, (VALUES ('STUDENT'), ('FACULTY'), ('GUEST')) AS ut(user_type)
      WHERE sc.venue_id = 1;
    `, [show1Id]);

    await pool.query(`
      UPDATE show_price SET price = 200.00 WHERE show_id = $1 AND user_type = 'FACULTY';
    `, [show1Id]);

    await pool.query(`
      INSERT INTO show_price (show_id, category_id, user_type, price)
      SELECT $1, sc.category_id, ut.user_type, 50.00
      FROM seat_category sc, (VALUES ('STUDENT'), ('FACULTY'), ('GUEST')) AS ut(user_type)
      WHERE sc.venue_id = 2;
    `, [show2Id]);

    // Create a show on a different event to test foreign showId 404
    const otherEventRes = await pool.query(`
      INSERT INTO event (club_id, title, event_type, duration_min)
      VALUES (1, 'ATT_TEST_Other_${testRunId}', 'CULTURAL', 60)
      RETURNING event_id;
    `);
    const otherEventId = otherEventRes.rows[0].event_id;
    const otherShowRes = await pool.query(`
      INSERT INTO show (event_id, venue_id, start_time, end_time, status)
      VALUES ($1, 2, $2, $3, 'SCHEDULED')
      RETURNING show_id;
    `, [otherEventId, new Date(now.getTime() + 300000000).toISOString(), new Date(now.getTime() + 307200000).toISOString()]);
    otherEventShowId = otherShowRes.rows[0].show_id;

    // 6. Create test users with various phone and name patterns
    // User 1: Has phone, special name with comma and double quote
    const user1Res = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, verified_at)
      VALUES ('att_user1_${testRunId}@seatsync.ac.in', 'hash', 'John "Johnny",', 'Smith', '9876543210', 'STUDENT', NOW())
      RETURNING user_id;
    `);
    const user1Id = user1Res.rows[0].user_id;

    // User 2: NULL phone, formula prefix in name '='
    const user2Res = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, verified_at)
      VALUES ('att_user2_${testRunId}@seatsync.ac.in', 'hash', '=FormulaUser', 'Test', NULL, 'FACULTY', NOW())
      RETURNING user_id;
    `);
    const user2Id = user2Res.rows[0].user_id;

    // User 3: For cancelled / unconfirmed tickets
    const user3Res = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, verified_at)
      VALUES ('att_user3_${testRunId}@seatsync.ac.in', 'hash', 'CancelledUser', NULL, '9123456789', 'GUEST', NOW())
      RETURNING user_id;
    `);
    const user3Id = user3Res.rows[0].user_id;

    // 7. Create Bookings and Tickets:
    // Confirmed booking 1 for Show 1 (User 1):
    const b1Res = await pool.query(`
      INSERT INTO booking (user_id, show_id, status, hold_expires_at, total_amount)
      VALUES ($1, $2, 'CONFIRMED', NOW() + INTERVAL '1 hour', 150.00)
      RETURNING booking_id;
    `, [user1Id, show1Id]);
    const booking1Id = b1Res.rows[0].booking_id;

    // Active ticket for Show 1: seat A-1
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 1, 'A', 1, 'STUDENT', 150.00, 'ACTIVE');
    `, [booking1Id, show1Id]);

    // Confirmed booking 2 for Show 1 (User 2):
    const b2Res = await pool.query(`
      INSERT INTO booking (user_id, show_id, status, hold_expires_at, total_amount)
      VALUES ($1, $2, 'CONFIRMED', NOW() + INTERVAL '1 hour', 200.00)
      RETURNING booking_id;
    `, [user2Id, show1Id]);
    const booking2Id = b2Res.rows[0].booking_id;

    // Active ticket for Show 1: seat B-2
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 1, 'B', 2, 'FACULTY', 200.00, 'ACTIVE');
    `, [booking2Id, show1Id]);

    // Confirmed booking 3 for Show 2 (Classroom - General admission):
    const b3Res = await pool.query(`
      INSERT INTO booking (user_id, show_id, status, hold_expires_at, total_amount)
      VALUES ($1, $2, 'CONFIRMED', NOW() + INTERVAL '1 hour', 50.00)
      RETURNING booking_id;
    `, [user1Id, show2Id]);
    const booking3Id = b3Res.rows[0].booking_id;

    // Active ticket for Show 2 (Classroom has NULL row_label and seat_no)
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 2, NULL, NULL, 'STUDENT', 50.00, 'ACTIVE');
    `, [booking3Id, show2Id]);

    // CANCELLED ticket in CONFIRMED booking (should be EXCLUDED)
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 1, 'C', 3, 'STUDENT', 150.00, 'CANCELLED');
    `, [booking1Id, show1Id]);

    // ACTIVE ticket in CANCELLED booking (should be EXCLUDED)
    const cancelledBookingRes = await pool.query(`
      INSERT INTO booking (user_id, show_id, status, hold_expires_at, total_amount)
      VALUES ($1, $2, 'CANCELLED', NOW() + INTERVAL '1 hour', 150.00)
      RETURNING booking_id;
    `, [user3Id, show1Id]);
    const cancelledBookingId = cancelledBookingRes.rows[0].booking_id;
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 1, 'D', 4, 'GUEST', 150.00, 'ACTIVE');
    `, [cancelledBookingId, show1Id]);

    // HELD ticket in PENDING booking (should be EXCLUDED)
    const pendingBookingRes = await pool.query(`
      INSERT INTO booking (user_id, show_id, status, hold_expires_at, total_amount)
      VALUES ($1, $2, 'PENDING', NOW() + INTERVAL '1 hour', 150.00)
      RETURNING booking_id;
    `, [user3Id, show1Id]);
    const pendingBookingId = pendingBookingRes.rows[0].booking_id;
    await pool.query(`
      INSERT INTO ticket (booking_id, show_id, venue_id, row_label, seat_no, attendee_type, price_paid, status)
      VALUES ($1, $2, 1, 'E', 5, 'GUEST', 150.00, 'HELD');
    `, [pendingBookingId, show1Id]);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. CSV Helper Unit Tests
  // ─────────────────────────────────────────────────────────────
  describe('1. CSV Helper Unit Tests', () => {
    it('does NOT quote-prefix whitelisted phone numbers starting with +', () => {
      const whitelisted1 = '+91 98765 43210';
      const whitelisted2 = '+1 (555) 123-4567';
      expect(isWhitelistedPhone(whitelisted1)).toBe(true);
      expect(isWhitelistedPhone(whitelisted2)).toBe(true);

      expect(neutralizeField(whitelisted1, true)).toBe(whitelisted1);
      expect(neutralizeField(whitelisted2, true)).toBe(whitelisted2);
    });

    it('neutralizes non-whitelisted phone column values (formula injection payloads)', () => {
      const payload1 = "+1+cmd|' /C calc'!A0";
      const payload2 = '=1+1';
      const payload3 = '+123'; // too short (< 6 chars)

      expect(isWhitelistedPhone(payload1)).toBe(false);
      expect(isWhitelistedPhone(payload2)).toBe(false);
      expect(isWhitelistedPhone(payload3)).toBe(false);

      expect(neutralizeField(payload1, true)).toBe(`'${payload1}`);
      expect(neutralizeField(payload2, true)).toBe(`'${payload2}`);
    });

    it('neutralizes formula prefixes (=, +, -, @, tab, cr) for non-phone fields', () => {
      expect(neutralizeField('=SUM(A1:A10)', false)).toBe("'=SUM(A1:A10)");
      expect(neutralizeField('+cmd', false)).toBe("'+cmd");
      expect(neutralizeField('-100', false)).toBe("'-100");
      expect(neutralizeField('@calc', false)).toBe("'@calc");
      expect(neutralizeField('\tTabbed', false)).toBe("'\tTabbed");
      expect(neutralizeField('\rReturn', false)).toBe("'\rReturn");
    });

    it('leaves regular text unmodified without prefix', () => {
      expect(neutralizeField('John Doe', false)).toBe('John Doe');
      expect(neutralizeField('', false)).toBe('');
      expect(neutralizeField(null, false)).toBe('');
      expect(neutralizeField(undefined, false)).toBe('');
    });

    it('escapes fields containing commas, double quotes, or newlines per RFC 4180', () => {
      expect(escapeField('Normal Text')).toBe('Normal Text');
      expect(escapeField('Doe, Jane')).toBe('"Doe, Jane"');
      expect(escapeField('John "Johnny" Doe')).toBe('"John ""Johnny"" Doe"');
      expect(escapeField('Line1\nLine2')).toBe('"Line1\nLine2"');
      expect(escapeField('Doe, "The Rock", Jr.')).toBe('"Doe, ""The Rock"", Jr."');
    });

    it('formats a complete row correctly', () => {
      const row = ['1', '10', '=EvilName', 'test@test.com', '+91 98765 43210'];
      const formatted = formatRow(row, [false, false, false, false, true]);
      // Cell 2 has '=EvilName' -> neutralized to "'=EvilName"
      // Cell 4 is whitelisted phone -> untouched "+91 98765 43210"
      expect(formatted).toBe("1,10,'=EvilName,test@test.com,+91 98765 43210");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Authorization and Route Validation
  // ─────────────────────────────────────────────────────────────
  describe('2. Authorization and Route Validation', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when user is not a club manager (student attendee)', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when user is a manager of a DIFFERENT club', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv`)
        .set('Authorization', `Bearer ${otherClubManagerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_CLUB_ACTION');
    });

    it('returns 404 when the event does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/events/999999/attendees.csv')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when showId belongs to another event', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv?showId=${otherEventShowId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Show not found for this event');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. CSV Content, Headers & Data Integrity
  // ─────────────────────────────────────────────────────────────
  describe('3. CSV Content, Headers & Data Integrity', () => {
    it('exports all confirmed active attendees across all shows of the event', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv;\s*charset=utf-8/i);
      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="attendees-att-test-festival-.*\.csv"/i);

      const text = res.text;
      // Must start with UTF-8 BOM
      expect(text.charCodeAt(0)).toBe(0xFEFF);

      const lines = text.replace(/^\uFEFF/, '').trim().split('\r\n');
      // Header + 3 confirmed active tickets = 4 lines
      expect(lines.length).toBe(4);

      // Verify exact header row
      const expectedHeader = 'Ticket ID,Booking ID,Attendee Name,Email,Phone,Account Type,Ticket Type,Show Date and Time,Venue,Seat,Price Paid,Booked At';
      expect(lines[0]).toBe(expectedHeader);

      // Ticket 1: User 1 with comma & quote in name
      // Name: John "Johnny", Smith -> escaped to "John ""Johnny"", Smith"
      expect(text).toContain('"John ""Johnny"", Smith"');
      expect(text).toContain('9876543210');
      expect(text).toContain('A-1');
      expect(text).toContain('150.00');

      // Ticket 2: User 2 with '=' in name -> neutralized with single quote "'=FormulaUser Test"
      expect(text).toContain("'=FormulaUser Test");
      expect(text).toContain('B-2');
      expect(text).toContain('200.00');

      // Ticket 3: Classroom show -> Seat must be "General admission"
      expect(text).toContain('General admission');
      expect(text).toContain('50.00');

      // EXCLUSIONS: Cancelled / held tickets / cancelled bookings must NOT appear
      expect(text).not.toContain('CancelledUser');
      expect(text).not.toContain('C-3'); // Cancelled ticket
      expect(text).not.toContain('D-4'); // Ticket in cancelled booking
      expect(text).not.toContain('E-5'); // Held ticket in pending booking
    });

    it('filters attendees by showId when showId query parameter is provided', async () => {
      const res = await request(app)
        .get(`/api/v1/organizer/events/${eventId}/attendees.csv?showId=${show1Id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain(`-show-${show1Id}-`);

      const text = res.text;
      const lines = text.replace(/^\uFEFF/, '').trim().split('\r\n');

      // Header + 2 tickets for Show 1 (Show 2 has the general admission ticket)
      expect(lines.length).toBe(3);
      expect(text).toContain('A-1');
      expect(text).toContain('B-2');
      expect(text).not.toContain('General admission');
    });

    it('returns 200 with only the header row for an event with no attendees', async () => {
      // Create empty event
      const emptyEventRes = await pool.query(`
        INSERT INTO event (club_id, title, event_type, duration_min)
        VALUES (1, 'ATT_TEST_Empty_${testRunId}', 'ACADEMIC', 60)
        RETURNING event_id;
      `);
      const emptyEventId = emptyEventRes.rows[0].event_id;

      const res = await request(app)
        .get(`/api/v1/organizer/events/${emptyEventId}/attendees.csv`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const text = res.text;
      expect(text.charCodeAt(0)).toBe(0xFEFF);

      const lines = text.replace(/^\uFEFF/, '').trim().split('\r\n');
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('Ticket ID,Booking ID,Attendee Name,Email,Phone,Account Type,Ticket Type,Show Date and Time,Venue,Seat,Price Paid,Booked At');
    });
  });
});
