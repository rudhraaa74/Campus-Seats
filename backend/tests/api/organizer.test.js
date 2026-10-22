// ─────────────────────────────────────────────────────────────
// backend/tests/api/organizer.test.js
// Integration tests for Organizer Setup (W4) & Booking Cancellation (W3)
// Enforces BR2 (venue overlap), BR10 (cancel cascade), BR11 (manager auth),
// BR12 (category venue check), and BR13 (show duration).
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Organizer Module & Cancellation API Tests (Phase 5)', () => {
  let managerToken = '';
  let studentToken = '';
  let managerUserId = 1;
  let studentUserId = 2;
  const testRunId = Date.now();

  const cleanupTestData = async () => {
    try {
      await pool.query(`DELETE FROM payment WHERE booking_id IN (SELECT booking_id FROM booking WHERE show_id IN (SELECT show_id FROM show WHERE event_id IN (SELECT event_id FROM event WHERE title LIKE 'ORG_TEST%')));`);
      await pool.query(`DELETE FROM ticket WHERE booking_id IN (SELECT booking_id FROM booking WHERE show_id IN (SELECT show_id FROM show WHERE event_id IN (SELECT event_id FROM event WHERE title LIKE 'ORG_TEST%')));`);
      await pool.query(`DELETE FROM booking WHERE show_id IN (SELECT show_id FROM show WHERE event_id IN (SELECT event_id FROM event WHERE title LIKE 'ORG_TEST%'));`);
      await pool.query(`DELETE FROM show_price WHERE show_id IN (SELECT show_id FROM show WHERE event_id IN (SELECT event_id FROM event WHERE title LIKE 'ORG_TEST%'));`);
      await pool.query(`DELETE FROM show WHERE event_id IN (SELECT event_id FROM event WHERE title LIKE 'ORG_TEST%');`);
      await pool.query(`DELETE FROM event WHERE title LIKE 'ORG_TEST%';`);
    } catch (e) {
      // ignore
    }
  };

  beforeAll(async () => {
    await cleanupTestData();

    // Login as club manager (user 1, manages club 1: Music Club)
    const managerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager@seatsync.ac.in',
        password: 'Password123!',
      });
    expect(managerLogin.status).toBe(200);
    managerToken = managerLogin.body.token;
    managerUserId = managerLogin.body.user.user_id;

    // Login as standard student attendee (user 2, not a manager)
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student1@seatsync.ac.in',
        password: 'Password123!',
      });
    expect(studentLogin.status).toBe(200);
    studentToken = studentLogin.body.token;
    studentUserId = studentLogin.body.user.user_id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('1. BR11: Club Manager Authorization Checks', () => {
    it('rejects unauthenticated requests to organizer routes with 401', async () => {
      const res = await request(app).get('/api/v1/organizer/venues');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-manager attendees with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/venues')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents a manager from creating events for a club they do not manage', async () => {
      // User 1 only manages Club 1 (Music Club), not Club 2 (Drama Society)
      const res = await request(app)
        .post('/api/v1/organizer/events')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          club_id: 2,
          title: 'Unauthorized Play',
          event_type: 'CULTURAL',
          duration_min: 90,
          description: 'Should be rejected',
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_CLUB_ACTION');
    });

    it('allows an authorized manager to retrieve venues and their categories', async () => {
      const res = await request(app)
        .get('/api/v1/organizer/venues')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.venues)).toBe(true);
      expect(res.body.venues.length).toBeGreaterThanOrEqual(2);

      // Verify categories aggregation
      const auditorium = res.body.venues.find((v) => v.venue_type === 'auditorium');
      expect(auditorium).toBeDefined();
      expect(auditorium.categories.some((c) => c.name === 'Gold')).toBe(true);
      expect(auditorium.categories.some((c) => c.name === 'Silver')).toBe(true);
    });
  });

  describe('2. Event Creation & Updating', () => {
    let createdEventId = null;

    it('creates a new event for an authorized club', async () => {
      const res = await request(app)
        .post('/api/v1/organizer/events')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          club_id: 1,
          title: `ORG_TEST_Battle of the Bands_${testRunId}`,
          event_type: 'CULTURAL',
          duration_min: 120,
          description: 'Annual inter-college rock band competition.',
        });

      expect(res.status).toBe(201);
      expect(res.body.event).toBeDefined();
      expect(res.body.event.duration_min).toBe(120);
      createdEventId = res.body.event.event_id;
    });

    it('updates an existing event', async () => {
      const res = await request(app)
        .put(`/api/v1/organizer/events/${createdEventId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: `ORG_TEST_Battle of the Bands_${testRunId} (Finale)`,
          duration_min: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.event.duration_min).toBe(150);
    });
  });

  describe('3. BR13 & BR2: Show Scheduling Validation', () => {
    let testEventId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/organizer/events')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          club_id: 1,
          title: `ORG_TEST_Jazz Evening_${testRunId}`,
          event_type: 'CULTURAL',
          duration_min: 120, // 2 hours
        });
      testEventId = res.body.event.event_id;
    });

    it('BR13: rejects show when show duration is shorter than event duration', async () => {
      // Event requires 120 minutes, scheduling only 60 minutes
      const res = await request(app)
        .post('/api/v1/organizer/shows')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          event_id: testEventId,
          venue_id: 1,
          start_time: '2027-02-15T18:00:00Z',
          end_time: '2027-02-15T19:00:00Z', // Only 60 min!
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/Show duration/i);
    });

    it('BR2: rejects show when venue is already booked for that time slot (exclusion constraint)', async () => {
      // Show 1 in seed is scheduled in Venue 1 from 2026-11-10 18:00 to 21:00 UTC
      const res = await request(app)
        .post('/api/v1/organizer/shows')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          event_id: testEventId,
          venue_id: 1,
          start_time: '2026-11-10T19:00:00Z', // Overlaps with Show 1!
          end_time: '2026-11-10T22:00:00Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VENUE_BUSY');
    });

    it('successfully schedules a valid non-overlapping show', async () => {
      const res = await request(app)
        .post('/api/v1/organizer/shows')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          event_id: testEventId,
          venue_id: 1,
          start_time: '2027-02-15T18:00:00Z',
          end_time: '2027-02-15T21:00:00Z', // 180 min >= 120 min
        });

      expect(res.status).toBe(201);
      expect(res.body.show.status).toBe('SCHEDULED');
      expect(res.body.show.venue_id).toBe(1);
    });
  });

  describe('4. BR12: Pricing Matrix Configuration', () => {
    let showId = null;

    beforeAll(async () => {
      const eventRes = await request(app)
        .post('/api/v1/organizer/events')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          club_id: 1,
          title: `ORG_TEST_Symphony Concert_${testRunId}`,
          duration_min: 90,
        });

      const showRes = await request(app)
        .post('/api/v1/organizer/shows')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          event_id: eventRes.body.event.event_id,
          venue_id: 1, // Auditorium (Categories 1: Gold, 2: Silver)
          start_time: '2027-03-01T18:00:00Z',
          end_time: '2027-03-01T20:30:00Z',
        });
      showId = showRes.body.show.show_id;
    });

    it('BR12: rejects price configuration for category belonging to another venue', async () => {
      // Category 3 is General, which belongs to Venue 2 (Classroom), NOT Venue 1
      const res = await request(app)
        .put(`/api/v1/organizer/shows/${showId}/prices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          prices: [
            { category_id: 3, user_type: 'STUDENT', price: 40.0 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/Seat category does not belong to the venue/i);
    });

    it('successfully configures prices for categories belonging to the show venue', async () => {
      const res = await request(app)
        .put(`/api/v1/organizer/shows/${showId}/prices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          prices: [
            { category_id: 1, user_type: 'STUDENT', price: 75.0 },
            { category_id: 1, user_type: 'FACULTY', price: 110.0 },
            { category_id: 1, user_type: 'GUEST', price: 180.0 },
            { category_id: 2, user_type: 'STUDENT', price: 45.0 },
            { category_id: 2, user_type: 'FACULTY', price: 75.0 },
            { category_id: 2, user_type: 'GUEST', price: 110.0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.prices.length).toBe(6);
    });
  });

  describe('5. BR10: Cancellation Cascades & Attendee Cancellation (W3 & W4)', () => {
    it('cancels an attendee booking and cascades ticket cancellation and payment refund (W3)', async () => {
      // 1. Student holds 2 seats for Show 1 (Row K Seats 1, 2)
      const holdRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: 1,
          tickets: [
            { row_label: 'K', seat_no: 1, attendee_type: 'STUDENT' },
            { row_label: 'K', seat_no: 2, attendee_type: 'STUDENT' },
          ],
        });
      expect(holdRes.status).toBe(201);
      const bookingId = holdRes.body.booking.booking_id;

      // 2. Student pays for the booking
      const payRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/pay`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ payment_method: 'UPI' });
      expect(payRes.status).toBe(200);
      expect(payRes.body.booking.status).toBe('CONFIRMED');

      // 3. Attendee cancels their booking
      const cancelRes = await request(app)
        .delete(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('CANCELLED');

      // 4. Verify in DB: all tickets are CANCELLED and payment is REFUNDED
      const ticketsRes = await pool.query('SELECT status FROM ticket WHERE booking_id = $1;', [bookingId]);
      expect(ticketsRes.rows.every((t) => t.status === 'CANCELLED')).toBe(true);

      const paymentRes = await pool.query('SELECT status FROM payment WHERE booking_id = $1;', [bookingId]);
      expect(paymentRes.rows[0].status).toBe('REFUNDED');

      // 5. Trying to cancel already cancelled booking returns 400
      const retryCancel = await request(app)
        .delete(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(retryCancel.status).toBe(400);
      expect(retryCancel.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
    });

    it('cancelling a show cascades cancellation to all its bookings and refunds attendees (W4)', async () => {
      // 1. Create a dedicated event & show to cancel
      const eventRes = await request(app)
        .post('/api/v1/organizer/events')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          club_id: 1,
          title: `ORG_TEST_Show To Cancel_${testRunId}`,
          duration_min: 90,
        });

      const showRes = await request(app)
        .post('/api/v1/organizer/shows')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          event_id: eventRes.body.event.event_id,
          venue_id: 1,
          start_time: '2027-04-01T18:00:00Z',
          end_time: '2027-04-01T20:30:00Z',
        });
      const showId = showRes.body.show.show_id;

      // Configure price
      await request(app)
        .put(`/api/v1/organizer/shows/${showId}/prices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          prices: [
            { category_id: 2, user_type: 'STUDENT', price: 50.0 },
          ],
        });

      // 2. Student books a seat for this show
      const holdRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          show_id: showId,
          tickets: [{ row_label: 'L', seat_no: 5, attendee_type: 'STUDENT' }],
        });
      expect(holdRes.status).toBe(201);
      const bookingId = holdRes.body.booking.booking_id;

      await request(app)
        .post(`/api/v1/bookings/${bookingId}/pay`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ payment_method: 'UPI' });

      // 3. Manager cancels the entire show
      const cancelShowRes = await request(app)
        .post(`/api/v1/organizer/shows/${showId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(cancelShowRes.status).toBe(200);
      expect(cancelShowRes.body.show.status).toBe('CANCELLED');

      // 4. Verify cascade in DB: booking is CANCELLED, ticket is CANCELLED, payment is REFUNDED
      const bookingCheck = await pool.query('SELECT status FROM booking WHERE booking_id = $1;', [bookingId]);
      expect(bookingCheck.rows[0].status).toBe('CANCELLED');

      const ticketCheck = await pool.query('SELECT status FROM ticket WHERE booking_id = $1;', [bookingId]);
      expect(ticketCheck.rows[0].status).toBe('CANCELLED');

      const payCheck = await pool.query('SELECT status FROM payment WHERE booking_id = $1;', [bookingId]);
      expect(payCheck.rows[0].status).toBe('REFUNDED');
    });
  });
});
