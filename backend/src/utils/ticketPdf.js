// ─────────────────────────────────────────────────────────────
// backend/src/utils/ticketPdf.js
// Generates official attendee E-Tickets and Tax Invoice PDF with QR codes
// ─────────────────────────────────────────────────────────────

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * Generates an official, beautifully formatted E-Ticket and Receipt PDF buffer
 * @param {Object} booking Detailed booking object
 * @param {Array} tickets Array of tickets associated with the booking
 * @returns {Promise<Buffer>}
 */
export async function generateTicketPdf(booking, tickets = []) {
  // Pre-generate QR code buffers for each ticket
  const ticketQrBuffers = await Promise.all(
    tickets.map(async (t) => {
      const payload = JSON.stringify({
        app: 'SeatSync',
        ticket_id: t.ticket_id,
        booking_id: booking.booking_id,
        show_id: booking.show_id,
        seat: t.row_label ? `${t.row_label}-${t.seat_no || t.seat_number}` : 'GA',
        attendee: t.attendee_type,
      });
      return QRCode.toBuffer(payload, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    })
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header Accent Bar
    doc.rect(40, 40, 515, 5).fill('#059669'); // Emerald-600

    // Title & Brand
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('SeatSync', 40, 55);
    doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('BITS Pilani Hyderabad Campus • Official E-Ticket & Receipt', 40, 80);

    // Booking Ref & Status (Right side)
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(`Booking Ref: #${booking.booking_id}`, 360, 55, { align: 'right', width: 195 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text(`Status: CONFIRMED`, 360, 72, { align: 'right', width: 195 });
    const bookedDateStr = booking.booked_at ? new Date(booking.booked_at).toLocaleString() : new Date().toLocaleString();
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(`Booked: ${bookedDateStr}`, 360, 86, { align: 'right', width: 195 });

    doc.moveTo(40, 105).lineTo(555, 105).strokeColor('#e2e8f0').stroke();

    // Event & Venue Section
    const startY = 120;
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(booking.event_title || 'Campus Event', 40, startY, { width: 515 });
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#059669').text(`Organized by ${booking.club_name || 'Campus Club'}`, 40, doc.y + 2);

    doc.moveDown(0.6);
    const eventDetailsY = doc.y;

    // Left column: Venue & Show Time
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569').text('VENUE & TIMING', 40, eventDetailsY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(booking.venue_name || 'Auditorium', 40, eventDetailsY + 14);
    const startTimeStr = booking.start_time
      ? new Date(booking.start_time).toLocaleString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Scheduled Time';
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(startTimeStr, 40, eventDetailsY + 28);

    // Right column: Attendee & Payment Summary
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569').text('BOOKED BY & INVOICE', 320, eventDetailsY);
    const userName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Attendee';
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(`${userName} (${booking.email || ''})`, 320, eventDetailsY + 14);
    const paidAmount = parseFloat(booking.paid_amount || booking.total_amount || 0).toFixed(2);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text(`Paid: INR ${paidAmount} via ${booking.payment_method || 'Online'}`, 320, eventDetailsY + 28);
    if (booking.gateway_ref) {
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(`Gateway Ref: ${booking.gateway_ref}`, 320, eventDetailsY + 41);
    }

    doc.moveDown(3);
    const dividerY = Math.max(doc.y, eventDetailsY + 55);
    doc.moveTo(40, dividerY).lineTo(555, dividerY).strokeColor('#e2e8f0').stroke();

    // Tickets Section Heading
    let currentY = dividerY + 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(`ADMISSION TICKETS (${tickets.length})`, 40, currentY);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Present each QR code at the venue entrance scanner for entry verification.', 40, currentY + 14);
    currentY += 32;

    // Render Ticket Cards
    tickets.forEach((t, idx) => {
      // Check if we need a page break
      if (currentY + 120 > 780) {
        doc.addPage();
        currentY = 40;
      }

      const cardHeight = 105;
      const cardWidth = 515;

      // Card Background & Border
      doc.roundedRect(40, currentY, cardWidth, cardHeight, 8).fillAndStroke('#f8fafc', '#cbd5e1');

      // Left Accent Strip
      doc.roundedRect(40, currentY, 6, cardHeight, 4).fill('#059669');

      // Ticket Info (Left column)
      const seatText = t.row_label ? `Row ${t.row_label}, Seat ${t.seat_no || t.seat_number}` : 'General Admission';
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(seatText, 56, currentY + 12);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#059669').text(`Ticket ID: #${t.ticket_id}`, 56, currentY + 30);

      const roleText = `${t.attendee_type || 'ATTENDEE'} PASS`;
      const catText = t.category_name ? ` • ${t.category_name}` : '';
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`${roleText}${catText}`, 56, currentY + 44);

      const priceVal = parseFloat(t.price || t.price_paid || 0).toFixed(2);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(`Price: INR ${priceVal}`, 56, currentY + 62);

      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8').text('Admit One • Valid for scheduled show only • Non-transferable', 56, currentY + 82);

      // QR Code on Right
      const qrBuf = ticketQrBuffers[idx];
      if (qrBuf) {
        doc.image(qrBuf, 440, currentY + 10, { width: 85 });
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('SCAN AT ENTRY', 440, currentY + 96, { width: 85, align: 'center' });
      }

      currentY += cardHeight + 12;
    });

    // Terms / Footer at the end of the document
    if (currentY + 50 > 790) {
      doc.addPage();
      currentY = 40;
    }
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8').text(
      'SeatSync Venue Management • BITS Pilani Hyderabad Campus • Please carry a valid campus ID card along with this pass.',
      40,
      currentY + 10,
      { align: 'center', width: 515 }
    );

    doc.end();
  });
}

