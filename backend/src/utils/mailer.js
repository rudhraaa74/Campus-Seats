// ─────────────────────────────────────────────────────────────
// backend/src/utils/mailer.js
// Nodemailer email service for OTP verification
// ─────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { generateTicketPdf } from './ticketPdf.js';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  // In test environment, use streamTransport to prevent hitting external SMTP rate limits with fake addresses
  if (process.env.NODE_ENV === 'test') {
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    return transporter;
  }

  // 1. Direct service support (e.g. Gmail)
  const isGmail = (env.smtp.service || '').toLowerCase() === 'gmail' || (env.smtp.user || '').endsWith('@gmail.com');
  if (isGmail || env.smtp.service) {
    transporter = nodemailer.createTransport({
      service: env.smtp.service || 'gmail',
      auth: {
        user: env.smtp.user,
        pass: isGmail && env.smtp.pass ? env.smtp.pass.replace(/\s+/g, '') : env.smtp.pass,
      },
    });
  } else if (env.smtp.host && env.smtp.user) {
    // 2. Custom SMTP host (Resend, Brevo, SendGrid, Amazon SES, etc.)
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  } else {
    // 3. Fallback: stream transport for local development without credentials
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
    const info = await t.sendMail(mailOptions);
    if (info && info.messageId && !info.message) {
      console.log(`✓ Real email delivered to ${toEmail} (MessageId: ${info.messageId})`);
    }
  } catch (err) {
    console.warn(`[Mailer Warning] Could not deliver email via transport: ${err.message}. (Code was logged in console above).`);
  }

  return { success: true };
}

/**
 * Sends a booking confirmation email with attached PDF tickets and tax invoice
 * @param {string} toEmail Recipient email address
 * @param {Object} booking Detailed booking object
 * @param {Array} tickets Array of tickets
 */
export async function sendBookingConfirmationEmail(toEmail, booking, tickets = []) {
  if (!toEmail) return { success: false, reason: 'No recipient email' };

  try {
    const pdfBuffer = await generateTicketPdf(booking, tickets);

    const userName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Attendee';
    const startTimeStr = booking.start_time
      ? new Date(booking.start_time).toLocaleString('en-IN', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Scheduled Time';

    const ticketListHtml = tickets
      .map((t) => {
        const seatText = t.row_label ? `Row ${t.row_label}, Seat ${t.seat_no || t.seat_number}` : 'General Admission';
        return `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; font-weight: 600; color: #1e293b; font-size: 13px;">${seatText}</td>
            <td style="padding: 10px 8px; color: #475569; font-size: 13px;">${t.attendee_type || 'ATTENDEE'}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #059669; font-size: 13px;">₹${parseFloat(t.price || t.price_paid || 0).toFixed(2)}</td>
          </tr>
        `;
      })
      .join('');

    const paidAmount = parseFloat(booking.paid_amount || booking.total_amount || 0).toFixed(2);

    const mailOptions = {
      from: env.smtp.from,
      to: toEmail,
      subject: `🎟 Booking Confirmed: ${booking.event_title} (Ref: #${booking.booking_id})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SeatSync</h1>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">BITS Pilani Hyderabad Campus • Booking Confirmation</p>
          </div>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #166534;">🎉 Your booking is confirmed!</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #15803d;">
              Hello ${userName}, your tickets for <strong>${booking.event_title}</strong> are ready. An official E-Ticket PDF with QR codes for admission is attached to this email.
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="color: #0f172a; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">Event & Venue Details</h3>
            <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a;">${booking.event_title}</p>
              <p style="margin: 0 0 6px; font-size: 13px; color: #059669; font-weight: 500;">Organized by ${booking.club_name || 'Campus Club'}</p>
              <p style="margin: 0 0 6px; font-size: 13px; color: #334155;">📍 <strong>Venue:</strong> ${booking.venue_name}</p>
              <p style="margin: 0; font-size: 13px; color: #334155;">🗓 <strong>Show Time:</strong> ${startTimeStr}</p>
            </div>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="color: #0f172a; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tickets & Invoice</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background-color: #f8fafc;">
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600;">SEAT</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600;">TYPE</th>
                  <th style="padding: 8px; text-align: right; font-size: 12px; color: #64748b; font-weight: 600;">PRICE</th>
                </tr>
              </thead>
              <tbody>
                ${ticketListHtml}
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td colspan="2" style="padding: 10px 8px; font-weight: 700; font-size: 14px; color: #0f172a;">Total Paid</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-size: 15px; color: #059669;">₹${paidAmount}</td>
                </tr>
              </tfoot>
            </table>
            <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8;">
              Payment Ref: ${booking.gateway_ref || 'Online'} • Method: ${booking.payment_method || 'Online'}
            </p>
          </div>

          <div style="padding: 14px; background-color: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0f172a;">📄 PDF E-Tickets Attached</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">
              Please open the attached PDF (<code>SeatSync-Tickets-Booking-${booking.booking_id}.pdf</code>) to view or save your entry passes. Carry your campus ID card for verification.
            </p>
          </div>

          <div style="text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            SeatSync — BITS Pilani Hyderabad Campus Venue Booking System
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `SeatSync-Tickets-Booking-${booking.booking_id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    console.log(`
┌────────────────────────────────────────────────────────┐
│  🎟  [SeatSync Ticket Confirmation Email]               │
│  To: ${toEmail.padEnd(46)}│
│  Booking ID: #${String(booking.booking_id).padEnd(39)}│
│  Event: ${(booking.event_title || '').slice(0, 44).padEnd(44)}│
│  PDF Size: ${(pdfBuffer.length + ' bytes').padEnd(41)}│
└────────────────────────────────────────────────────────┘
    `);

    const t = await getTransporter();
    const info = await t.sendMail(mailOptions);
    if (info && info.messageId && !info.message) {
      console.log(`✓ Real ticket confirmation email delivered to ${toEmail} (MessageId: ${info.messageId})`);
    }

    return { success: true, messageId: info?.messageId };
  } catch (err) {
    console.warn(`[Mailer Warning] Could not deliver ticket email: ${err.message}`);
    return { success: false, error: err.message };
  }
}
