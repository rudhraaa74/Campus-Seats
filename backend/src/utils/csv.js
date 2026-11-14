// ─────────────────────────────────────────────────────────────
// backend/src/utils/csv.js
// RFC 4180 compliant CSV serializer with Formula Injection protection
// ─────────────────────────────────────────────────────────────

/**
 * Characters that could trigger spreadsheet formula execution in Excel/Sheets
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Whitelist regex for valid telephone numbers:
 * Optional leading '+', then only digits, spaces, hyphens, and parentheses.
 * Length must be between 6 and 20 characters.
 *
 * Real numbers like "+91 98765 43210" must NOT be quote-prefixed.
 * Malicious values starting with '+' that fail this regex (e.g. "+1+cmd|' /C calc'!A0")
 * will be neutralized.
 */
export function isWhitelistedPhone(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 6 || trimmed.length > 20) return false;
  return /^\+?[0-9\s\-()]+$/.test(trimmed);
}

/**
 * Neutralizes spreadsheet formula injection.
 * If text starts with =, +, -, @, tab, or carriage return, prefixes with a single quote.
 * Exception: Phone column values matching the strict phone whitelist are preserved as-is.
 */
export function neutralizeField(value, isPhoneColumn = false) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  if (str === '') {
    return '';
  }

  // Whitelisted phone numbers starting with '+' should NOT be prefixed with a single quote
  if (isPhoneColumn && isWhitelistedPhone(str)) {
    return str;
  }

  // Neutralize formula injection
  if (FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  return str;
}

/**
 * RFC 4180 field escaping:
 * If a field contains a comma, double-quote, or newline (\n, \r),
 * double any internal quotes and wrap the whole field in double quotes.
 */
export function escapeField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats a single row of cells into an RFC 4180 CSV line with formula protection
 * @param {Array<any>} cells
 * @param {Array<boolean>} isPhoneFlags - boolean flags indicating which index is a phone column
 * @returns {string}
 */
export function formatRow(cells, isPhoneFlags = []) {
  return cells
    .map((cell, idx) => {
      const isPhone = Boolean(isPhoneFlags[idx]);
      const neutralized = neutralizeField(cell, isPhone);
      return escapeField(neutralized);
    })
    .join(',');
}

/**
 * Generates the full CSV content for attendees export:
 * Prepend UTF-8 BOM (\uFEFF) for Excel compatibility.
 * Line endings are CRLF (\r\n) per RFC 4180.
 *
 * @param {Array<object>} attendees
 * @returns {string}
 */
export function buildAttendeesCsv(attendees = []) {
  const headers = [
    'Ticket ID',
    'Booking ID',
    'Attendee Name',
    'Email',
    'Phone',
    'Account Type',
    'Ticket Type',
    'Show Date and Time',
    'Venue',
    'Seat',
    'Price Paid',
    'Booked At',
  ];

  // Index 4 is the Phone column
  const isPhoneFlags = headers.map((_, i) => i === 4);

  const lines = [
    formatRow(headers), // header row has no phone column neutralization needed
  ];

  for (const a of attendees) {
    const showDateTime = a.show_date_time ? new Date(a.show_date_time).toISOString() : '';
    const bookedAt = a.booked_at ? new Date(a.booked_at).toISOString() : '';
    const pricePaid = a.price_paid !== null && a.price_paid !== undefined
      ? Number(a.price_paid).toFixed(2)
      : '0.00';

    const rowCells = [
      a.ticket_id,
      a.booking_id,
      a.attendee_name || '',
      a.email || '',
      a.phone !== null && a.phone !== undefined ? a.phone : '',
      a.account_type || '',
      a.ticket_type || '',
      showDateTime,
      a.venue_name || '',
      a.seat || 'General admission',
      pricePaid,
      bookedAt,
    ];

    lines.push(formatRow(rowCells, isPhoneFlags));
  }

  // Prepend UTF-8 BOM and join with CRLF
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

