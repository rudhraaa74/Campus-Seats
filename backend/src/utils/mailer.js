// ─────────────────────────────────────────────────────────────
// backend/src/utils/mailer.js
// Nodemailer email service for OTP verification
// ─────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (env.smtp.host && env.smtp.user) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  } else {
    // Development / fallback transporter
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }

  return transporter;
}

/**
 * Sends a 6-digit verification code to the user's email
 * @param {string} toEmail
 * @param {string} code 6-digit OTP code
 * @param {string} firstName
 */
export async function sendOtpEmail(toEmail, code, firstName = 'User') {
  const mailOptions = {
    from: env.smtp.from,
    to: toEmail,
    subject: `${code} is your SeatSync verification code`,
    text: `Hello ${firstName},\n\nYour SeatSync email verification code is: ${code}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, please ignore this email.\n\n— SeatSync Campus Venue Booking`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700;">SeatSync</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Campus Venue Booking System</p>
        </div>
        <div style="padding: 20px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
          <p style="color: #334155; font-size: 15px; margin-bottom: 16px;">Hello <strong>${firstName}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">Use the verification code below to verify your email address and activate your account:</p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #059669; background-color: #ecfdf5; padding: 12px 28px; border-radius: 8px; border: 1px dashed #059669;">
              ${code}
            </span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
            ⏱ This code is valid for <strong>10 minutes</strong>. For security, never share this code with anyone.
          </p>
        </div>
        <div style="margin-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          SeatSync — BITS Pilani Campus Venue Booking System
        </div>
      </div>
    `,
  };

  // Always log in console for demo / presentation safety
  console.log(`
┌────────────────────────────────────────────────────────┐
│  📧 [SeatSync OTP Email]                               │
│  To: ${toEmail.padEnd(46)}│
│  Name: ${firstName.padEnd(44)}│
│  Code: ${code.padEnd(44)}│
│  Valid for: 10 minutes                                 │
└────────────────────────────────────────────────────────┘
  `);

  try {
    const t = await getTransporter();
    await t.sendMail(mailOptions);
  } catch (err) {
    console.warn(`[Mailer Warning] Could not deliver email via transport: ${err.message}. (Code was logged in console above).`);
  }

  return { success: true };
}
