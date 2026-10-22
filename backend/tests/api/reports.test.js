// ─────────────────────────────────────────────────────────────
// backend/tests/api/reports.test.js
// Integration test suite for Phase 6 Analytics & Complex Reports (W5)
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

describe('Reports & Analytical API (Phase 6 / Workflow W5)', () => {
  let managerToken;
  let attendeeToken;

  beforeAll(async () => {
    // 1. Authenticate manager (user_id: 1, club_id: 1)
    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@seatsync.ac.in', password: 'Password123!' });
    managerToken = mgrRes.body.token;

    // 2. Authenticate regular student (user_id: 2, non-manager)
    const attRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student1@seatsync.ac.in', password: 'Password123!' });
    attendeeToken = attRes.body.token;
  });

  // 1. Role Authorization Check (Rule BR11)
  test('Non-manager attendee is rejected with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary')
      .set('Authorization', `Bearer ${attendeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Unauthenticated request is rejected with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/reports/summary');
    expect(res.status).toBe(401);
  });

  // 2. Cross-Club Authorization Check
  test('Manager cannot access report for a club they do not manage (Club 2: Drama Society)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary?clubId=2')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 3. KPI Summary Endpoint
  test('GET /api/v1/reports/summary returns overall metrics for manager club', async () => {
    const res = await request(app)
      .get('/api/v1/reports/summary')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total_shows).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.total_events).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.confirmed_tickets).toBeGreaterThanOrEqual(1);
    expect(Number(res.body.summary.total_revenue)).toBeGreaterThanOrEqual(0);
    expect(res.body.summary.avg_occupancy_pct).toBeDefined();
  });

  // 4. Show Occupancy Report (Query 1: Joins, GROUP BY, view v_venue_capacity)
  test('GET /api/v1/reports/occupancy returns capacity and occupancy percentages', async () => {
    const res = await request(app)
      .get('/api/v1/reports/occupancy')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.occupancy)).toBe(true);
    expect(res.body.occupancy.length).toBeGreaterThanOrEqual(1);

    const firstShow = res.body.occupancy[0];
    expect(firstShow).toHaveProperty('show_id');
    expect(firstShow).toHaveProperty('event_title');
    expect(firstShow).toHaveProperty('venue_name');
    expect(firstShow).toHaveProperty('total_capacity');
    expect(firstShow).toHaveProperty('confirmed_tickets');
    expect(firstShow).toHaveProperty('occupancy_pct');
    expect(Number(firstShow.occupancy_pct)).toBeGreaterThanOrEqual(0);
  });

  // 5. Revenue Breakdown (Query 2: CTE + Aggregation by attendee type)
  test('GET /api/v1/reports/revenue breaks down sales by attendee tier', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.revenue)).toBe(true);

    if (res.body.revenue.length > 0) {
      const revItem = res.body.revenue[0];
      expect(revItem).toHaveProperty('event_title');
      expect(revItem).toHaveProperty('student_tickets');
      expect(revItem).toHaveProperty('student_revenue');
      expect(revItem).toHaveProperty('faculty_tickets');
      expect(revItem).toHaveProperty('faculty_revenue');
      expect(revItem).toHaveProperty('guest_tickets');
      expect(revItem).toHaveProperty('guest_revenue');
      expect(revItem).toHaveProperty('total_revenue');
      expect(Number(revItem.total_revenue)).toBe(
        Number(revItem.student_revenue) + Number(revItem.faculty_revenue) + Number(revItem.guest_revenue)
      );
    }
  });

  // 6. Top Ranked Events (Query 3: Window Function DENSE_RANK)
  test('GET /api/v1/reports/top-events returns events ordered by DENSE_RANK', async () => {
    const res = await request(app)
      .get('/api/v1/reports/top-events')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.topEvents)).toBe(true);

    if (res.body.topEvents.length > 1) {
      const top1 = res.body.topEvents[0];
      const top2 = res.body.topEvents[1];
      expect(top1.revenue_rank).toBe(1);
      expect(Number(top1.total_revenue)).toBeGreaterThanOrEqual(Number(top2.total_revenue));
    }
  });

  // 7. Unsold Shows (Query 4: Correlated Subquery with NOT EXISTS)
  test('GET /api/v1/reports/unsold-shows identifies shows without live tickets', async () => {
    const res = await request(app)
      .get('/api/v1/reports/unsold-shows')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.unsoldShows)).toBe(true);

    // Verify none of the returned shows have active tickets
    for (const show of res.body.unsoldShows) {
      const checkRes = await pool.query(
        "SELECT COUNT(*) FROM ticket WHERE show_id = $1 AND status IN ('ACTIVE', 'HELD')",
        [show.show_id]
      );
      expect(parseInt(checkRes.rows[0].count, 10)).toBe(0);
    }
  });

  // 8. Active Attendees (Query 5: GROUP BY + HAVING)
  test('GET /api/v1/reports/active-attendees returns users with booking counts meeting threshold', async () => {
    const res = await request(app)
      .get('/api/v1/reports/active-attendees?minBookings=1')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activeAttendees)).toBe(true);

    for (const attendee of res.body.activeAttendees) {
      expect(attendee.total_bookings).toBeGreaterThanOrEqual(1);
      expect(attendee).toHaveProperty('first_name');
      expect(attendee).toHaveProperty('email');
      expect(attendee).toHaveProperty('total_spent');
    }
  });
});
