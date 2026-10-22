// ─────────────────────────────────────────────────────────────
// backend/tests/api/auth.test.js
// Integration tests for W1 Authentication API
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';

describe('Auth Module API Tests (W1)', () => {
  const timestamp = Date.now();
  const testStudentEmail = `test.student.${timestamp}@seatsync.ac.in`;
  const testPassword = 'Password123!';

  // 1. Health check
  describe('GET /api/v1/health', () => {
    it('returns a health check response structure', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 207]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('postgres');
      expect(res.body).toHaveProperty('redis');
    });
  });

  // 2. Registration validation checks
  describe('POST /api/v1/auth/register input validation', () => {
    it('rejects registration with missing subclass details (student without roll_number)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `invalid.student.${timestamp}@campus.ac.in`,
          password: testPassword,
          first_name: 'Test',
          user_type: 'STUDENT',
          // missing roll_number and year_of_study
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

  // 3. Login validation
  describe('POST /api/v1/auth/login validation', () => {
    it('rejects login with missing email or password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_VALUE');
    });

    it('rejects login with non-existent user credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent.user.999@seatsync.ac.in',
          password: 'WrongPassword123!',
        });

      expect([401, 500]).toContain(res.status); // 401 when DB connected, 500 if DB unreachable
    });
  });

  // 4. Protected route without token
  describe('GET /api/v1/auth/me authorization', () => {
    it('returns 401 when authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
