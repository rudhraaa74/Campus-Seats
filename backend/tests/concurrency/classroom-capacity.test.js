// ─────────────────────────────────────────────────────────────
// backend/tests/concurrency/classroom-capacity.test.js
// High-concurrency race condition test for General Admission Classroom capacity
// Verifies that trigger fn_check_ticket_venue_seating_and_capacity locks the
// show row (SELECT ... FOR UPDATE) so parallel transactions never oversell capacity.
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Concurrency Check: Classroom Capacity Over-selling Protection', () => {
  const PARALLEL_REQUESTS = 6;
  const CAPACITY = 2; // Only 2 passes available
  const tokens = [];
  const timestamp = Date.now();
  let testVenueId = null;
  let testCategoryId = null;
  let testShowId = null;

  beforeAll(async () => {
    // 1. Create an isolated classroom venue with capacity = 2
    const venueRes = await pool.query(`
      INSERT INTO venue (name, venue_type, capacity)
      VALUES ($1, 'CLASSROOM', $2)
      RETURNING venue_id;
    `, [`Test Classroom ${timestamp}`, CAPACITY]);
    testVenueId = venueRes.rows[0].venue_id;

    const catRes = await pool.query(`
      INSERT INTO seat_category (venue_id, name)
      VALUES ($1, 'General')
      RETURNING category_id;
    `, [testVenueId]);
    testCategoryId = catRes.rows[0].category_id;

    // 2. Create a test scheduled show in this mini classroom (at least 180 min for event 1)
    const showRes = await pool.query(`
      INSERT INTO show (event_id, venue_id, start_time, end_time, status)
      VALUES (1, $1, CURRENT_TIMESTAMP + INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '10 days 4 hours', 'SCHEDULED')
      RETURNING show_id;
    `, [testVenueId]);
    testShowId = showRes.rows[0].show_id;

    await pool.query(`
      INSERT INTO show_price (show_id, category_id, user_type, price)
      VALUES 
        ($1, $2, 'STUDENT', 50.00),
        ($1, $2, 'FACULTY', 75.00),
        ($1, $2, 'GUEST', 100.00);
    `, [testShowId, testCategoryId]);

    // 3. Register parallel distinct users
    for (let i = 0; i < PARALLEL_REQUESTS; i++) {
      const email = `classroom.race.${timestamp}.${i}@seatsync.ac.in`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!',
          first_name: `ClassUser${i}`,
          last_name: 'Tester',
          user_type: 'STUDENT',
          roll_number: `ROLL_CR_${timestamp}_${i}`,
          year_of_study: 3,
        });
      tokens.push(res.body.token);
    }
  }, 20000);

  afterAll(async () => {
    try {
      if (testShowId) {
        await pool.query(`DELETE FROM payment WHERE booking_id IN (SELECT booking_id FROM booking WHERE show_id = $1);`, [testShowId]);
        await pool.query(`DELETE FROM ticket WHERE show_id = $1;`, [testShowId]);
        await pool.query(`DELETE FROM booking WHERE show_id = $1;`, [testShowId]);
        await pool.query(`DELETE FROM show_price WHERE show_id = $1;`, [testShowId]);
        await pool.query(`DELETE FROM show WHERE show_id = $1;`, [testShowId]);
      }
      if (testCategoryId) {
        await pool.query(`DELETE FROM seat_category WHERE category_id = $1;`, [testCategoryId]);
      }
      if (testVenueId) {
        await pool.query(`DELETE FROM venue WHERE venue_id = $1;`, [testVenueId]);
      }
      await pool.query(`DELETE FROM student WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'classroom.race.%');`);
      await pool.query(`DELETE FROM users WHERE email LIKE 'classroom.race.%';`);
    } catch (e) {
      // ignore teardown error
    }
    await pool.end();
    redis.disconnect();
  });

  it('strictly limits live bookings to venue capacity when parallel requests contest last passes', async () => {
    // Fire all parallel requests simultaneously, each requesting 1 pass for a venue of capacity = 2
    const promises = tokens.map((token) =>
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          show_id: testShowId,
          ticket_count: 1,
        })
    );

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status >= 400);

    // Exactly 2 bookings must succeed because capacity is 2
    expect(successes.length).toBe(CAPACITY);
    expect(rejected.length).toBe(PARALLEL_REQUESTS - CAPACITY);

    // Database verification: total live tickets (HELD or ACTIVE) must NEVER exceed capacity
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ticket WHERE show_id = $1 AND status IN ('HELD', 'ACTIVE');`,
      [testShowId]
    );
    expect(countRes.rows[0].count).toBe(CAPACITY);
  }, 20000);
});
