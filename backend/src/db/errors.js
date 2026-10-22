// ─────────────────────────────────────────────────────────────
// backend/src/db/errors.js
// Maps PostgreSQL error codes & constraint names to standard API errors
// ─────────────────────────────────────────────────────────────

/**
 * Standardized error mapping table based on PLAN.md Section 4
 *
 * PostgreSQL Error Codes:
 *   23505: unique_violation
 *   23P01: exclusion_violation
 *   23514: check_violation
 *   23503: foreign_key_violation
 *   P0001: raise_exception (raised by custom triggers)
 */

const CONSTRAINT_MAP = {
  // Unique violations (23505)
  uq_ticket_live_seat: {
    status: 409,
    code: 'SEAT_TAKEN',
    message: 'That seat was just taken by another attendee.',
  },
  uq_users_email: {
    status: 409,
    code: 'EMAIL_EXISTS',
    message: 'Email address is already registered.',
  },
  uq_student_roll_no: {
    status: 409,
    code: 'ROLL_EXISTS',
    message: 'Student roll number is already registered.',
  },
  uq_faculty_employee_id: {
    status: 409,
    code: 'EMPLOYEE_ID_EXISTS',
    message: 'Faculty employee ID is already registered.',
  },
  uq_payment_one_success: {
    status: 409,
    code: 'PAYMENT_EXISTS',
    message: 'This booking already has a completed successful payment.',
  },
  uq_club_name: {
    status: 409,
    code: 'CLUB_EXISTS',
    message: 'A club with this name already exists.',
  },
  uq_venue_name: {
    status: 409,
    code: 'VENUE_EXISTS',
    message: 'A venue with this name already exists.',
  },

  // Exclusion violations (23P01)
  ex_show_venue_overlap: {
    status: 409,
    code: 'VENUE_BUSY',
    message: 'The selected venue is already occupied by another show during this time slot.',
  },
};

/**
 * Translates database errors into HTTP status and user-facing error objects
 * @param {any} err
 * @returns {{ status: number, body: { error: { code: string, message: string } } }}
 */
export function mapDatabaseError(err) {
  // 1. Direct match on known constraint name
  if (err.constraint && CONSTRAINT_MAP[err.constraint]) {
    const match = CONSTRAINT_MAP[err.constraint];
    return {
      status: match.status,
      body: { error: { code: match.code, message: match.message } },
    };
  }

  // 2. Trigger exceptions (ERRCODE P0001)
  if (err.code === 'P0001') {
    let errorCode = 'BUSINESS_RULE_VIOLATION';
    let status = 422;

    if (err.message.includes('capacity')) {
      errorCode = 'CAPACITY_FULL';
      status = 409;
    } else if (err.message.includes('6') || (err.message.toLowerCase().includes('limit') && !err.message.toLowerCase().includes('subsid'))) {
      errorCode = 'TICKET_LIMIT';
      status = 422;
    } else if (err.message.toLowerCase().includes('subsidised') || err.message.toLowerCase().includes('subsidized')) {
      errorCode = 'SUBSIDY_LIMIT';
      status = 422;
    } else if (err.message.toLowerCase().includes('window') || err.message.toLowerCase().includes('cancelled') || err.message.toLowerCase().includes('past')) {
      errorCode = 'SHOW_NOT_BOOKABLE';
      status = 422;
    }

    return {
      status,
      body: {
        error: {
          code: errorCode,
          message: err.message,
        },
      },
    };
  }

  // 3. Generic Unique Violation
  if (err.code === '23505') {
    return {
      status: 409,
      body: { error: { code: 'DUPLICATE_ENTRY', message: err.detail || 'Duplicate entry violated a unique constraint.' } },
    };
  }

  // 4. Check constraint violations
  if (err.code === '23514') {
    return {
      status: 422,
      body: { error: { code: 'INVALID_VALUE', message: err.detail || 'Data failed a database check constraint.' } },
    };
  }

  // 5. Foreign Key violations
  if (err.code === '23503') {
    return {
      status: 409,
      body: { error: { code: 'REFERENCE_ERROR', message: err.detail || 'Referenced record was not found or is in use.' } },
    };
  }

  // 6. Generic Exclusion violation
  if (err.code === '23P01') {
    return {
      status: 409,
      body: { error: { code: 'VENUE_BUSY', message: 'Scheduling conflict detected for the selected venue and time.' } },
    };
  }

  // Default internal server error
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected database error occurred.',
      },
    },
  };
}
