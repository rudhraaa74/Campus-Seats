// ─────────────────────────────────────────────────────────────
// backend/tests/api/auth.test.js
// Integration tests for W1 Authentication API (Live DB)
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Auth Module API Tests (W1)', () => {
  const timestamp = Date.now();
  const testStudentEmail = `live.student.${timestamp}@seatsync.ac.in`;
  const testFacultyEmail = `live.faculty.${timestamp}@seatsync.ac.in`;
  const testGuestEmail = `live.guest.${timestamp}@seatsync.ac.in`;
  const testPassword = 'Password123!';
  let studentToken = '';

  afterAll(async () => {
    await pool.end();
    redis.disconnect();
  });

  // 1. Health check
  describe('GET /api/v1/health', () => {
    it('returns connected status for postgres and redis', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 207]).toContain(res.status);
      expect(res.body.status).toBe('healthy');
      expect(res.body.postgres).toBe('connected');
      expect(res.body.redis).toBe('connected');
    });
  });

  // 2. Input validation
  describe('POST /api/v1/auth/register validation', () => {
    it('rejects registration with missing subclass details (student without roll_number)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `invalid.student.${timestamp}@campus.ac.in`,
          password: testPassword,
          first_name: 'Test',
          user_type: 'STUDENT',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_VALUE');
    });

    it('rejects registration with an invalid user_type', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `invalid.role.${timestamp}@campus.ac.in`,
          password: testPassword,
          first_name: 'Test',
          user_type: 'SUPERUSER',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_VALUE');
    });
  });

  // 3. Live registration of all 3 user types (W1 Transaction)
  describe('Live registration of all 3 user types', () => {
    it('registers a student with subclass details', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testStudentEmail,
          password: testPassword,
          first_name: 'LiveStudent',
          last_name: 'Tester',
          phone: '9876543299',
          user_type: 'STUDENT',
          roll_number: `ROLL_${timestamp}`,
          year_of_study: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.user_type).toBe('STUDENT');
      studentToken = res.body.token;
    });

    it('registers a faculty member with employee_id and department', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testFacultyEmail,
          password: testPassword,
          first_name: 'Prof',
          last_name: 'Tester',
          phone: '9876543298',
          user_type: 'FACULTY',
          employee_id: `EMP_${timestamp}`,
          department: 'Physics',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.user_type).toBe('FACULTY');
    });

    it('registers a guest with affiliation', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testGuestEmail,
          password: testPassword,
          first_name: 'Guest',
          last_name: 'Tester',
          user_type: 'GUEST',
          affiliation: 'Campus Visitor',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.user_type).toBe('GUEST');
    });

    it('rejects duplicate email and returns EMAIL_EXISTS (constraint mapping)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testStudentEmail, // duplicate email
          password: testPassword,
          first_name: 'Duplicate',
          user_type: 'STUDENT',
          roll_number: `DUP_ROLL_${timestamp}`,
          year_of_study: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
      expect(res.body.error.message).toBe('Email address is already registered.');
    });
  });

  // 4. Live Login
  describe('POST /api/v1/auth/login', () => {
    it('rejects login with missing email or password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_VALUE');
    });

    it('rejects login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('successfully logs in with valid credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.user_type).toBe('STUDENT');
    });

    it('successfully logs in with seeded demo student account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'student1@seatsync.ac.in',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('student1@seatsync.ac.in');
    });
  });

  // 5. Protected profile route
  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when token is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns full student profile with roll_no and year_of_study when token is provided', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.roll_no).toBe(`ROLL_${timestamp}`);
      expect(res.body.user.year_of_study).toBe(2);
    });
  });
});
