// ─────────────────────────────────────────────────────────────
// backend/src/redis/otp.js
// Temporary OTP code generation, hashing & Redis storage
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { redis } from './client.js';
import { env } from '../config/env.js';

const OTP_PREFIX = 'otp:';

/**
 * Computes a SHA-256 hash of the plain OTP code
 */
function hashOtp(code) {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

/**
 * Generates a random 6-digit OTP code, stores only its SHA-256 hash in Redis,
 * and returns the plain code for email delivery.
 * @param {string} email
 * @returns {Promise<string>} 6-digit plain code
 */
export async function createAndStoreOtp(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const code = crypto.randomInt(100000, 1000000).toString();
  const hash = hashOtp(code);

  const payload = {
    hash,
    attempts: 0,
    createdAt: Date.now(),
    lastSentAt: Date.now(),
  };

  const key = `${OTP_PREFIX}${normalizedEmail}`;
  await redis.set(key, JSON.stringify(payload), 'EX', env.otp.ttlSeconds);

  return code;
}

/**
 * Checks whether the user is in a resend cooldown period
 * @param {string} email
 * @returns {Promise<{ allowed: boolean, waitSeconds?: number }>}
 */
export async function checkResendCooldown(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${OTP_PREFIX}${normalizedEmail}`;
  const raw = await redis.get(key);

  if (!raw) {
    return { allowed: true };
  }

  try {
    const data = JSON.parse(raw);
    const elapsedSeconds = Math.floor((Date.now() - data.lastSentAt) / 1000);
    const cooldown = env.otp.resendCooldownSeconds;

    if (elapsedSeconds < cooldown) {
      return {
        allowed: false,
        waitSeconds: cooldown - elapsedSeconds,
      };
    }
  } catch (err) {
    // If parse error, allow resend
  }

  return { allowed: true };
}

/**
 * Verifies an OTP code using timing-safe comparison
 * @param {string} email
 * @param {string} inputCode
 * @returns {Promise<{ success: boolean, code?: string, message?: string }>}
 */
export async function verifyOtpCode(email, inputCode) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${OTP_PREFIX}${normalizedEmail}`;
  const raw = await redis.get(key);

  if (!raw) {
    return {
      success: false,
      code: 'OTP_EXPIRED_OR_NOT_FOUND',
      message: 'Verification code has expired or is invalid. Please request a new code.',
    };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    await redis.del(key);
    return {
      success: false,
      code: 'INVALID_OTP',
      message: 'Failed to process verification code. Please request a new one.',
    };
  }

  // Check attempt limit
  if (data.attempts >= env.otp.maxAttempts) {
    await redis.del(key);
    return {
      success: false,
      code: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Maximum verification attempts exceeded. Please request a new code.',
    };
  }

  const inputHash = hashOtp(inputCode);
  const inputHashBuf = Buffer.from(inputHash, 'utf8');
  const storedHashBuf = Buffer.from(data.hash, 'utf8');

  const isMatch =
    inputHashBuf.length === storedHashBuf.length &&
    crypto.timingSafeEqual(inputHashBuf, storedHashBuf);

  if (!isMatch) {
    // Increment attempts
    const newAttempts = data.attempts + 1;
    const remainingTtl = await redis.ttl(key);

    if (newAttempts >= env.otp.maxAttempts) {
      await redis.del(key);
      return {
        success: false,
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      };
    }

    data.attempts = newAttempts;
    if (remainingTtl > 0) {
      await redis.set(key, JSON.stringify(data), 'EX', remainingTtl);
    }

    const remainingAttempts = env.otp.maxAttempts - newAttempts;
    return {
      success: false,
      code: 'INVALID_OTP',
      message: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
    };
  }

  // Successful verification: delete single-use OTP key immediately
  await redis.del(key);
  return { success: true };
}

/**
 * Removes any active OTP key for an email
 */
export async function clearOtp(email) {
  const normalizedEmail = email.toLowerCase().trim();
  await redis.del(`${OTP_PREFIX}${normalizedEmail}`);
}
