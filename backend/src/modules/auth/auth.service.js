// ─────────────────────────────────────────────────────────────
// backend/src/modules/auth/auth.service.js
// Business logic for user registration, OTP email verification, authentication & profile
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withTransaction } from '../../db/transaction.js';
import { pool } from '../../db/pool.js';
import { authQueries } from './auth.queries.js';
import { env } from '../../config/env.js';
import { createAndStoreOtp, verifyOtpCode, checkResendCooldown } from '../../redis/otp.js';
import { sendOtpEmail } from '../../utils/mailer.js';

/**
 * Generates a signed JWT payload with user details and managed club IDs
 */
function generateToken(user, clubIds = []) {
  const payload = {
    userId: user.user_id,
    email: user.email,
    userType: user.user_type,
    isVerified: !!user.verified_at,
    clubIds,
  };

  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/**
 * Registers a new user and their corresponding subclass row in a single transaction.
 * Generates a 6-digit OTP code, stores its hash in Redis with a 10-minute expiry,
 * and sends the code to the user's email via Nodemailer.
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
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedType = (user_type || '').toUpperCase();

  if (!['STUDENT', 'FACULTY', 'GUEST'].includes(normalizedType)) {
    const err = new Error('Invalid user_type. Must be STUDENT, FACULTY, or GUEST.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  // Institutional domain enforcement for role claims (Student & Faculty)
  if (['STUDENT', 'FACULTY'].includes(normalizedType)) {
    const atParts = normalizedEmail.split('@');
    const domain = atParts[1] || '';
    const isAllowed = env.campus.allowedDomains.some(
      (d) => domain === d || domain.endsWith('.' + d)
    );
    if (!isAllowed) {
      const err = new Error(
        `Students and faculty must register with an institutional email address (@${env.campus.allowedDomains.join(' or @')}).`
      );
      err.status = 422;
      err.code = 'CAMPUS_DOMAIN_REQUIRED';
      throw err;
    }
  }

  // Validate phone number format: exactly 10 digits, cannot start with 0 or country code
  if (phone) {
    const cleanPhone = phone.trim();
    if (!/^[1-9]\d{9}$/.test(cleanPhone)) {
      const err = new Error(
        'Phone number must be exactly 10 digits and cannot start with 0 or a country code (e.g. 9876543210).'
      );
      err.status = 422;
      err.code = 'INVALID_PHONE';
      throw err;
    }
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

  // Check for email squatting: only replace unverified account if older than 1 day (24 hours)
  const existingRes = await pool.query(authQueries.findUserByEmail, [normalizedEmail]);
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    if (existing.verified_at) {
      const err = new Error('Email address is already registered.');
      err.status = 409;
      err.code = 'EMAIL_EXISTS';
      throw err;
    }

    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (ageMs > oneDayMs) {
      // Stale unverified registration older than 24h: allow replacement
      await pool.query(authQueries.deleteUnverifiedUser, [normalizedEmail]);
    } else {
      const err = new Error('Email address is already registered.');
      err.status = 409;
      err.code = 'EMAIL_EXISTS';
      err.unverified = true;
      throw err;
    }
  }

  // Hash password with bcryptjs
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Single transaction inserts the superclass row (unverified) and subclass row (W1)
  const user = await withTransaction(async (client) => {
    // 1. Insert into users superclass table
    const userRes = await client.query(authQueries.insertUser, [
      normalizedEmail,
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

  // Generate 6-digit OTP code & store its SHA-256 hash in Redis (10 min TTL)
  const otp = await createAndStoreOtp(normalizedEmail);

  // Deliver email
  await sendOtpEmail(normalizedEmail, otp, user.first_name);

  const token = generateToken(user, []);

  return {
    message: 'Registration successful. A 6-digit verification code has been sent to your email.',
    email: user.email,
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_type: user.user_type,
      is_verified: false,
      verified_at: null,
    },
    demo_otp: env.otp.demoMode ? otp : undefined,
  };
}

/**
 * Verifies a 6-digit OTP code against Redis and marks user as verified in PostgreSQL
 */
export async function verifyUserOtp(email, otp) {
  if (!email || !otp) {
    const err = new Error('Email and 6-digit verification code are required.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const userRes = await pool.query(authQueries.findUserByEmail, [normalizedEmail]);
  const user = userRes.rows[0];

  if (!user) {
    const err = new Error('User account not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (user.verified_at) {
    const clubsRes = await pool.query(authQueries.findManagedClubs, [user.user_id]);
    const clubIds = clubsRes.rows.map((row) => row.club_id);
    const token = generateToken(user, clubIds);

    return {
      message: 'Email is already verified.',
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        is_verified: true,
        verified_at: user.verified_at,
      },
    };
  }

  // Verify code with Redis timingSafeEqual check
  const result = await verifyOtpCode(normalizedEmail, otp);
  if (!result.success) {
    const err = new Error(result.message);
    err.status = result.code === 'MAX_ATTEMPTS_EXCEEDED' ? 429 : 422;
    err.code = result.code;
    throw err;
  }

  // Update verified_at in PostgreSQL
  const updateRes = await pool.query(authQueries.markUserVerified, [normalizedEmail]);
  const updatedUser = updateRes.rows[0];

  const clubsRes = await pool.query(authQueries.findManagedClubs, [updatedUser.user_id]);
  const clubIds = clubsRes.rows.map((row) => row.club_id);
  const token = generateToken(updatedUser, clubIds);

  return {
    message: 'Email verified successfully! You can now book tickets.',
    token,
    user: {
      user_id: updatedUser.user_id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      user_type: updatedUser.user_type,
      is_verified: true,
      verified_at: updatedUser.verified_at,
    },
  };
}

/**
 * Resends a fresh 6-digit OTP code if cooldown has passed
 */
export async function resendUserOtp(email) {
  if (!email) {
    const err = new Error('Email is required.');
    err.status = 422;
    err.code = 'INVALID_VALUE';
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userRes = await pool.query(authQueries.findUserByEmail, [normalizedEmail]);
  const user = userRes.rows[0];

  if (!user) {
    const err = new Error('User account not found.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (user.verified_at) {
    const err = new Error('This account is already verified.');
    err.status = 400;
    err.code = 'ALREADY_VERIFIED';
    throw err;
  }

  // Check 60-second resend cooldown
  const cooldown = await checkResendCooldown(normalizedEmail);
  if (!cooldown.allowed) {
    const err = new Error(`Please wait ${cooldown.waitSeconds} seconds before requesting a new code.`);
    err.status = 429;
    err.code = 'COOLDOWN_ACTIVE';
    err.waitSeconds = cooldown.waitSeconds;
    throw err;
  }

  // Generate new OTP & deliver
  const otp = await createAndStoreOtp(normalizedEmail);
  await sendOtpEmail(normalizedEmail, otp, user.first_name);

  return {
    message: 'A new 6-digit verification code has been sent to your email.',
    email: normalizedEmail,
    demo_otp: env.otp.demoMode ? otp : undefined,
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
      is_verified: !!user.verified_at,
      verified_at: user.verified_at,
      clubIds,
      clubs: clubsRes.rows,
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
  user.is_verified = !!user.verified_at;

  return user;
}
