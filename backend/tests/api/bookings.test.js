// ─────────────────────────────────────────────────────────────
// backend/tests/api/bookings.test.js
// Integration tests for Hold, Pay, Confirm (W2 / Phase 4)
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Bookings & Payments Module API Tests (Phase 4)', () => {
  let studentToken = '';
  let facultyToken = '';
  let guestToken = '';
  const timestamp = Date.now();

  beforeAll(async () => {
    // Clean up any lingering test records
    await pool.query(`DELETE FROM payment WHERE booking_id IN (SELECT booking_id FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%'));`);
    await pool.query(`DELETE FROM ticket WHERE booking_id IN (SELECT booking_id FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%'));`);
    await pool.query(`DELETE FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%');`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'booking.%';`);

    // Register test attendees for isolation
    const studentRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `booking.student.${timestamp}@seatsync.ac.in`,
        password: 'Password123!',
        first_name: 'BookStudent',
        last_name: 'Tester',
        user_type: 'STUDENT',
        roll_number: `ROLL_${timestamp}`,
        year_of_study: 3,
      });
    studentToken = studentRes.body.token;

    const facultyRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `booking.faculty.${timestamp}@seatsync.ac.in`,
        password: 'Password123!',
        first_name: 'BookFaculty',
        last_name: 'Tester',
        user_type: 'FACULTY',
        employee_id: `EMP_${timestamp}`,
        department: 'CS',
      });
    facultyToken = facultyRes.body.token;

    const guestRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `booking.guest.${timestamp}@seatsync.ac.in`,
        password: 'Password123!',
        first_name: 'BookGuest',
        last_name: 'Tester',
        user_type: 'GUEST',
        affiliation: 'Visitor',
      });
    guestToken = guestRes.body.token;
  });



  // 1. Authentication requirement
  describe('Authorization checks', () => {
    it('returns 401 when booking without token', async () => {
      const res = await request(app).post('/api/v1/bookings').send({ show_id: 1, tickets: [{ row_label: 'A', seat_no: 5 }] });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // 2. Successful Seat Hold (5-minute timer)
  describe('POST /api/v1/bookings (Hold seats)', () => {
    let createdBookingId = null;

    it('successfully holds seats and returns PENDING booking with 5-min expiry', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: 1,
          tickets: [
            { row_label: 'C', seat_no: 10, attendee_type: 'STUDENT' },
            { row_label: 'C', seat_no: 11, attendee_type: 'GUEST' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('booking');
      expect(res.body.booking.status).toBe('PENDING');
      expect(res.body.booking).toHaveProperty('hold_expires_at');
      expect(res.body.booking.tickets.length).toBe(2);

      createdBookingId = res.body.booking.booking_id;

      // Verify that Redis hold key was created with positive TTL
      const ttl = await redis.ttl(`hold:${createdBookingId}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('successfully holds 3 seats for a student with student rate on all tickets', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: 1,
          tickets: [
            { row_label: 'E', seat_no: 1 },
            { row_label: 'E', seat_no: 2 },
            { row_label: 'E', seat_no: 3 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.tickets.length).toBe(3);
      // All tickets default to STUDENT rate since buyer is a student
      expect(res.body.booking.tickets[0].attendee_type).toBe('STUDENT');
      expect(res.body.booking.tickets[1].attendee_type).toBe('STUDENT');
      expect(res.body.booking.tickets[2].attendee_type).toBe('STUDENT');
    });

    it('successfully holds general admission tickets for a classroom show with FACULTY attendee type at faculty rate', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: 3,
          ticket_count: 2,
          attendee_type: 'FACULTY',
          tickets: [
            { attendee_type: 'FACULTY' },
            { attendee_type: 'FACULTY' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.tickets.length).toBe(2);
      expect(res.body.booking.tickets[0].attendee_type).toBe('FACULTY');
      expect(res.body.booking.tickets[0].price).toBe(50);
      expect(res.body.booking.tickets[1].attendee_type).toBe('FACULTY');
      expect(res.body.booking.tickets[1].price).toBe(50);
      expect(res.body.booking.total_amount).toBe(100);
    });

    it('successfully holds general admission tickets for GUEST when passing attendee_type without tickets array', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: 3,
          ticket_count: 1,
          attendee_type: 'GUEST',
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.tickets.length).toBe(1);
      expect(res.body.booking.tickets[0].attendee_type).toBe('GUEST');
      expect(res.body.booking.tickets[0].price).toBe(80);
      expect(res.body.booking.total_amount).toBe(80);
    });

    it('rejects attempt to hold an already held seat (SEAT_TAKEN)', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          show_id: 1,
          tickets: [{ row_label: 'C', seat_no: 10, attendee_type: 'GUEST' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SEAT_TAKEN');
    });

    it('rejects booking with more than 6 tickets (TICKET_LIMIT)', async () => {
      const tickets = [
        { row_label: 'D', seat_no: 1, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 2, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 3, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 4, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 5, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 6, attendee_type: 'GUEST' },
        { row_label: 'D', seat_no: 7, attendee_type: 'GUEST' },
      ];

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ show_id: 1, tickets });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TICKET_LIMIT');
    });
  });

  // 3. Payment Processing
  describe('POST /api/v1/bookings/:id/pay', () => {
    let bookingToPayId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          show_id: 1,
          tickets: [{ row_label: 'D', seat_no: 15, attendee_type: 'FACULTY' }],
        });
      bookingToPayId = res.body.booking.booking_id;
    });

    it('simulates payment failure if requested without confirming booking', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingToPayId}/pay`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ payment_method: 'UPI', simulate_failure: true });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PAYMENT_FAILED');

      // Verify booking is still PENDING
      const detail = await request(app)
        .get(`/api/v1/bookings/${bookingToPayId}`)
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(detail.body.booking.status).toBe('PENDING');
    });

    it('successfully confirms booking, records payment, and deletes Redis hold key', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingToPayId}/pay`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ payment_method: 'CREDIT_CARD' });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('CONFIRMED');
      expect(res.body.booking.payment.status).toBe('SUCCESS');

      // Verify Redis hold key was cleared
      const ttl = await redis.ttl(`hold:${bookingToPayId}`);
      expect(ttl).toBe(-2); // -2 indicates key does not exist

      // Verify tickets are now ACTIVE
      const detail = await request(app)
        .get(`/api/v1/bookings/${bookingToPayId}`)
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(detail.body.booking.tickets[0].status).toBe('ACTIVE');
    });

    it('idempotently returns existing confirmation when paying for an already confirmed booking', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingToPayId}/pay`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ payment_method: 'UPI' });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('CONFIRMED');
      expect(res.body.booking.payment.status).toBe('SUCCESS');
    });

    it('rejects payment on expired hold (HOLD_EXPIRED)', async () => {
      // Create a booking directly in DB with past hold_expires_at
      const pastBookingRes = await pool.query(`
        INSERT INTO booking (user_id, show_id, booked_at, hold_expires_at, status, total_amount)
        VALUES (
          (SELECT user_id FROM users WHERE email = 'booking.guest.${timestamp}@seatsync.ac.in'),
          1,
          CURRENT_TIMESTAMP - INTERVAL '10 minutes',
          CURRENT_TIMESTAMP - INTERVAL '5 minutes',
          'PENDING',
          100.00
        )
        RETURNING booking_id;
      `);
      const expiredBookingId = pastBookingRes.rows[0].booking_id;

      const res = await request(app)
        .post(`/api/v1/bookings/${expiredBookingId}/pay`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ payment_method: 'UPI' });

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('HOLD_EXPIRED');
    });
  });

  // 4. Classroom General Admission Booking
  describe('Classroom Booking (Show 3)', () => {
    it('successfully books general admission classroom tickets', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          show_id: 3,
          ticket_count: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.status).toBe('PENDING');
      expect(res.body.booking.tickets.length).toBe(2);
      expect(res.body.booking.tickets[0].row_label).toBeNull();
      expect(res.body.booking.tickets[0].seat_no).toBeNull();
    });
  });

  // 5. GET /api/v1/bookings/mine
  describe('GET /api/v1/bookings/mine', () => {
    it('lists attendee bookings history', async () => {
      const res = await request(app)
        .get('/api/v1/bookings/mine')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('bookings');
      expect(Array.isArray(res.body.bookings)).toBe(true);
      expect(res.body.bookings.length).toBeGreaterThanOrEqual(1);
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM payment WHERE booking_id IN (SELECT booking_id FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%'));`);
    await pool.query(`DELETE FROM ticket WHERE booking_id IN (SELECT booking_id FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%'));`);
    await pool.query(`DELETE FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'booking.%');`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'booking.%';`);
  });
});
