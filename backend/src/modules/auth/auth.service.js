// ─────────────────────────────────────────────────────────────
// backend/src/modules/auth/auth.service.js
// Business logic for user registration, authentication & profile
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withTransaction } from '../../db/transaction.js';
import { pool } from '../../db/pool.js';
import { authQueries } from './auth.queries.js';
import { env } from '../../config/env.js';

/**
 * Generates a signed JWT payload with user details and managed club IDs
 */
function generateToken(user, clubIds = []) {
  const payload = {
    userId: user.user_id,
    email: user.email,
    userType: user.user_type,
    clubIds,
  };

  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/**
 * Registers a new user and their corresponding subclass row in a single transaction.
 */
export async function registerUser({
  email,
  password,
  first_name,
  last_name,
  phone,
  user_type,
  roll_number,
  year_of_study,
  employee_id,
  department,
  affiliation,
}) {
  const normalizedType = (user_type || '').toUpperCase();

  if (!['STUDENT', 'FACULTY', 'GUEST'].includes(normalizedType)) {
    const err = new Error('Invalid user_type. Must be STUDENT, FACULTY, or GUEST.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  // Validate subclass requirements before starting the database transaction
  if (normalizedType === 'STUDENT' && (!roll_number || !year_of_study)) {
    const err = new Error('Students require roll_number and year_of_study (1-5).');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  if (normalizedType === 'FACULTY' && (!employee_id || !department)) {
    const err = new Error('Faculty members require employee_id and department.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  if (normalizedType === 'GUEST' && !affiliation) {
    const err = new Error('Guests require an affiliation.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  // Hash password with bcryptjs
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Single transaction inserts the superclass row and subclass row (W1)
  const user = await withTransaction(async (client) => {
    // 1. Insert into users superclass table
    const userRes = await client.query(authQueries.insertUser, [
      email.toLowerCase().trim(),
      passwordHash,
      first_name.trim(),
      last_name ? last_name.trim() : null,
      phone ? phone.trim() : null,
      normalizedType,
    ]);

    const createdUser = userRes.rows[0];

    // 2. Insert into the appropriate specialization subclass table
    if (normalizedType === 'STUDENT') {
      await client.query(authQueries.insertStudent, [
        createdUser.user_id,
        roll_number.trim(),
        parseInt(year_of_study, 10),
      ]);
    } else if (normalizedType === 'FACULTY') {
      await client.query(authQueries.insertFaculty, [
        createdUser.user_id,
        employee_id.trim(),
        department.trim(),
      ]);
    } else if (normalizedType === 'GUEST') {
      await client.query(authQueries.insertGuest, [
        createdUser.user_id,
        affiliation.trim(),
      ]);
    }

    return createdUser;
  });

  const token = generateToken(user, []);

  return {
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_type: user.user_type,
    },
  };
}

/**
 * Authenticates a user by email and password
 */
export async function loginUser(email, password) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  // Find user by email
  const res = await pool.query(authQueries.findUserByEmail, [email.toLowerCase().trim()]);
  const user = res.rows[0];

  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Fetch managed clubs if the user is a club manager
  const clubsRes = await pool.query(authQueries.findManagedClubs, [user.user_id]);
  const clubIds = clubsRes.rows.map((row) => row.club_id);

  const token = generateToken(user, clubIds);

  return {
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_type: user.user_type,
      clubIds,
    },
  };
}

/**
 * Retrieves the authenticated user's complete profile
 */
export async function getUserProfile(userId) {
  const userRes = await pool.query(authQueries.findUserProfile, [userId]);
  const user = userRes.rows[0];

  if (!user) {
    const err = new Error('User profile not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const clubsRes = await pool.query(authQueries.findManagedClubs, [userId]);
  user.clubs = clubsRes.rows;
  user.clubIds = clubsRes.rows.map((row) => row.club_id);

  return user;
}
