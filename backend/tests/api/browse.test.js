// ─────────────────────────────────────────────────────────────
// backend/tests/api/browse.test.js
// Integration tests for Events and Shows browsing APIs (Phase 3)
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Browse Module API Tests (Phase 3)', () => {
  afterAll(async () => {
    // Cleanly close connection pool & redis after test run
    await pool.end();
    redis.disconnect();
  });


  // 1. GET /api/v1/events
  describe('GET /api/v1/events', () => {
    it('returns list of events with pagination metadata', async () => {
      const res = await request(app).get('/api/v1/events');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('page', 1);

      const event = res.body.events[0];
      expect(event).toHaveProperty('event_id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('club_name');
    });

    it('filters events by type', async () => {
      const res = await request(app).get('/api/v1/events?type=CULTURAL');
      expect(res.status).toBe(200);
      expect(res.body.events.every((e) => e.type === 'CULTURAL')).toBe(true);
    });

    it('searches events by title query q', async () => {
      const res = await request(app).get('/api/v1/events?q=Rock');
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
      expect(res.body.events[0].title).toContain('Rock');
    });

    it('returns empty list for non-matching search query', async () => {
      const res = await request(app).get('/api/v1/events?q=NonExistentQueryXYZ123');
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('returns available filter options at /api/v1/events/filters', async () => {
      const res = await request(app).get('/api/v1/events/filters');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clubs');
      expect(res.body).toHaveProperty('types');
      expect(Array.isArray(res.body.clubs)).toBe(true);
      expect(Array.isArray(res.body.types)).toBe(true);
    });
  });

  // 2. GET /api/v1/events/:id
  describe('GET /api/v1/events/:id', () => {
    it('returns event details and scheduled shows for valid event ID', async () => {
      const res = await request(app).get('/api/v1/events/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('event');
      expect(res.body.event.event_id).toBe(1);
      expect(res.body.event).toHaveProperty('club');
      expect(res.body.event).toHaveProperty('shows');
      expect(Array.isArray(res.body.event.shows)).toBe(true);
      expect(res.body.event.shows.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent event ID', async () => {
      const res = await request(app).get('/api/v1/events/999999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid event ID parameter', async () => {
      const res = await request(app).get('/api/v1/events/invalid_id');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PARAMETER');
    });
  });

  // 3. GET /api/v1/shows/:id
  describe('GET /api/v1/shows/:id', () => {
    it('returns show details with venue and structured prices', async () => {
      const res = await request(app).get('/api/v1/shows/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('show');
      expect(res.body.show.show_id).toBe(1);
      expect(res.body.show).toHaveProperty('venue');
      expect(res.body.show.venue.name).toBe('Main Auditorium');
      expect(res.body.show).toHaveProperty('prices');
      expect(Array.isArray(res.body.show.prices)).toBe(true);

      const priceTier = res.body.show.prices[0];
      expect(priceTier).toHaveProperty('category_name');
      expect(priceTier).toHaveProperty('student_price');
      expect(priceTier).toHaveProperty('faculty_price');
      expect(priceTier).toHaveProperty('guest_price');
    });

    it('returns 404 for non-existent show ID', async () => {
      const res = await request(app).get('/api/v1/shows/999999');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // 4. GET /api/v1/shows/:id/seats
  describe('GET /api/v1/shows/:id/seats', () => {
    it('returns auditorium seats with live statuses for Show 1', async () => {
      const res = await request(app).get('/api/v1/shows/1/seats');
      expect(res.status).toBe(200);
      expect(res.body.venue_type).toBe('auditorium');
      expect(res.body).toHaveProperty('seats');
      expect(Array.isArray(res.body.seats)).toBe(true);
      expect(res.body.seats.length).toBe(40); // 40 numbered seats

      // Verify that confirmed ticket seats A-1 and A-2 are marked 'sold'
      const seatA1 = res.body.seats.find((s) => s.row_label === 'A' && s.seat_no === 1);
      const seatA2 = res.body.seats.find((s) => s.row_label === 'A' && s.seat_no === 2);
      const seatA3 = res.body.seats.find((s) => s.row_label === 'A' && s.seat_no === 3);

      expect(seatA1).toBeDefined();
      expect(seatA1.status).toBe('sold');
      expect(seatA2).toBeDefined();
      expect(seatA2.status).toBe('sold');
      expect(seatA3).toBeDefined();
      expect(seatA3.status).toBe('free');
    });

    it('returns classroom general admission capacity and remaining slots for Show 3', async () => {
      const res = await request(app).get('/api/v1/shows/3/seats');
      expect(res.status).toBe(200);
      expect(res.body.venue_type).toBe('classroom');
      expect(res.body.capacity).toBe(60);
      expect(res.body).toHaveProperty('remaining');
      expect(res.body.remaining).toBe(59); // 1 active ticket booked
      expect(res.body.category_name).toBe('General');
    });
  });
});
