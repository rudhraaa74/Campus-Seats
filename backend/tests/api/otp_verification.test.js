// ─────────────────────────────────────────────────────────────
// backend/tests/api/otp_verification.test.js
// Tests for institutional email domain checks, OTP generation,
// Redis-backed verification, resend cooldowns, and unverified booking block
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redis } from '../../src/redis/client.js';

describe('Email Domain Rule & OTP Verification Tests', () => {
  const timestamp = Date.now();
  const validStudentEmail = `otp.student.${timestamp}@hyderabad.bits-pilani.ac.in`;
  const validFacultyEmail = `otp.faculty.${timestamp}@hyderabad.bits-pilani.ac.in`;
  const nonCampusEmail = `external.user.${timestamp}@gmail.com`;
  const testPassword = 'Password123!';

  afterAll(async () => {
    await pool.end();
    redis.disconnect();
  });

  // 1. Institutional Domain & Phone Number Enforcement
  describe('Domain & Phone Number Rules for Registration', () => {
    it('rejects student registration with an external non-campus email domain', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: nonCampusEmail,
          password: testPassword,
          first_name: 'FakeStudent',
          user_type: 'STUDENT',
          roll_number: `ROLL_${timestamp}`,
          year_of_study: 1,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CAMPUS_DOMAIN_REQUIRED');
      expect(res.body.error.message).toContain('institutional email address');
    });

    it('rejects faculty registration with an external non-campus email domain', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `prof.${timestamp}@yahoo.com`,
          password: testPassword,
          first_name: 'FakeProf',
          user_type: 'FACULTY',
          employee_id: `EMP_${timestamp}`,
          department: 'Computer Science',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CAMPUS_DOMAIN_REQUIRED');
    });

    it('rejects phone number starting with 0', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `phone.zero.${timestamp}@hyderabad.bits-pilani.ac.in`,
          password: testPassword,
          first_name: 'ZeroPhone',
          phone: '0987654321',
          user_type: 'STUDENT',
          roll_number: `ROLL_Z_${timestamp}`,
          year_of_study: 1,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_PHONE');
      expect(res.body.error.message).toContain('cannot start with 0');
    });

    it('rejects phone number with country code (more than 10 digits)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `phone.cc.${timestamp}@hyderabad.bits-pilani.ac.in`,
          password: testPassword,
          first_name: 'CCPhone',
          phone: '919876543210',
          user_type: 'STUDENT',
          roll_number: `ROLL_CC_${timestamp}`,
          year_of_study: 1,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_PHONE');
    });

    it('allows guest registration with any valid email domain and valid 10-digit phone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `guest.${timestamp}@gmail.com`,
          password: testPassword,
          first_name: 'ValidGuest',
          phone: '9876543210',
          user_type: 'GUEST',
          affiliation: 'External Visitor',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.is_verified).toBe(false);
      expect(res.body).toHaveProperty('demo_otp');
    });
  });

  // 2. OTP Delivery & Redis Verification Flow
  describe('OTP Lifecycle & Verification', () => {
    let capturedOtp = '';

    it('registers a student with institutional email and receives demo_otp', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: validStudentEmail,
          password: testPassword,
          first_name: 'StudentTester',
          user_type: 'STUDENT',
          roll_number: `ROLL_OTP_${timestamp}`,
          year_of_study: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.is_verified).toBe(false);
      expect(res.body).toHaveProperty('demo_otp');
      capturedOtp = res.body.demo_otp;
      expect(capturedOtp).toMatch(/^[0-9]{6}$/);
    });

    it('rejects verification with wrong OTP code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: validStudentEmail,
          otp: '000000',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_OTP');
      expect(res.body.error.message).toContain('remaining');
    });

    it('enforces 60-second cooldown on immediate resend attempt', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-otp')
        .send({
          email: validStudentEmail,
        });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('COOLDOWN_ACTIVE');
      expect(res.body.error.message).toContain('Please wait');
    });

    it('verifies account successfully with correct OTP code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: validStudentEmail,
          otp: capturedOtp,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.is_verified).toBe(true);
      expect(res.body.user.verified_at).not.toBeNull();

      // Database verification
      const dbRes = await pool.query('SELECT verified_at FROM users WHERE email = $1;', [validStudentEmail]);
      expect(dbRes.rows[0].verified_at).not.toBeNull();
    });

    it('rejects resend request once account is already verified', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-otp')
        .send({
          email: validStudentEmail,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_VERIFIED');
    });
  });

  // 3. Database Trigger Protection Against Unverified Bookings
  describe('Database Enforcement: Only Verified Users Can Book', () => {
    let unverifiedToken = '';

    beforeAll(async () => {
      // Register an unverified faculty member
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: validFacultyEmail,
          password: testPassword,
          first_name: 'UnverifiedProf',
          user_type: 'FACULTY',
          employee_id: `EMP_UNV_${timestamp}`,
          department: 'Mathematics',
        });
      unverifiedToken = regRes.body.token;
    });

    it('blocks unverified user from creating a booking (enforced by DB trigger)', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          show_id: 1,
          tickets: [{ row_label: 'A', seat_no: 1 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UNVERIFIED_USER');
      expect(res.body.error.message).toContain('verify their email before booking');
    });
  });
});
