// ─────────────────────────────────────────────────────────────
// backend/tests/concurrency/double-booking.test.js
// High-concurrency race condition test for double bookings
// Fires 20 parallel hold requests for the exact same seat.
// Expects exactly 1 success (201) and 19 conflict rejections (409 SEAT_TAKEN).
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Concurrency Check: Double Booking Race Condition', () => {
  const CONCURRENT_ATTEMPTS = 20;
  const tokens = [];
  const timestamp = Date.now();
  const testSeatRow = 'B';
  const testSeatNo = 20;

  beforeAll(async () => {
    // Register 20 distinct users to fire parallel independent transactions
    for (let i = 0; i < CONCURRENT_ATTEMPTS; i++) {
      const email = `race.user.${timestamp}.${i}@seatsync.ac.in`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!',
          first_name: `RaceUser${i}`,
          last_name: 'Tester',
          user_type: 'GUEST',
          affiliation: 'Concurrency Testing',
        });
      tokens.push(res.body.token);
    }
  }, 15000);

  afterAll(async () => {
    // Teardown test bookings and users
    try {
      await pool.query(
        `DELETE FROM ticket WHERE show_id = 1 AND row_label = $1 AND seat_no = $2;`,
        [testSeatRow, testSeatNo]
      );
      await pool.query(
        `DELETE FROM booking WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'race.user.%');`
      );
      await pool.query(
        `DELETE FROM users WHERE email LIKE 'race.user.%';`
      );
    } catch (e) {
      // ignore teardown error
    }
    await pool.end();
    redis.disconnect();
  });

  it('allows exactly 1 booking and rejects 19 with SEAT_TAKEN when 20 requests hit simultaneously', async () => {
    // Fire all 20 requests in parallel
    const promises = tokens.map((token) =>
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          show_id: 1,
          tickets: [{ row_label: testSeatRow, seat_no: testSeatNo, attendee_type: 'GUEST' }],
        })
    );

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409 && r.body.error?.code === 'SEAT_TAKEN');

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);

    // Verify in database that exactly ONE live ticket exists on that seat
    const dbCheck = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ticket WHERE show_id = 1 AND row_label = $1 AND seat_no = $2 AND status IN ('HELD', 'ACTIVE');`,
      [testSeatRow, testSeatNo]
    );
    expect(dbCheck.rows[0].count).toBe(1);
  }, 15000);
});
