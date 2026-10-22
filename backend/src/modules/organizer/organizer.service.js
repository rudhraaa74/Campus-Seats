// ─────────────────────────────────────────────────────────────
// backend/src/modules/organizer/organizer.service.js
// Business logic for organizer events, shows, pricing & cancellation (BR11)
// ─────────────────────────────────────────────────────────────

import { withTransaction } from '../../db/transaction.js';
import * as queries from './organizer.queries.js';

/**
 * Retrieves all venues with their categories
 */
export async function listVenues() {
  const venues = await queries.getVenuesWithCategories();
  return { venues };
}

/**
 * Retrieves all events managed by the club manager
 */
export async function listClubEvents(clubIds) {
  const events = await queries.getEventsByClubs(clubIds);
  return { events };
}

/**
 * Retrieves all shows managed by the club manager
 */
export async function listClubShows(clubIds) {
  const shows = await queries.getShowsByClubs(clubIds);
  return { shows };
}

/**
 * Creates or updates a classroom venue with room number and capacity
 */
export async function createClassroomVenue({ roomNumber, capacity }) {
  if (!roomNumber || !roomNumber.trim()) {
    const error = new Error('Room number/name is required for classroom.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }
  const cap = parseInt(capacity, 10);
  if (!cap || cap <= 0) {
    const error = new Error('Classroom capacity must be a positive integer.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const venue = await queries.getOrCreateClassroomVenue({ roomNumber, capacity: cap });
  return { venue };
}

/**
 * Creates a new event for an authorized club (BR11)
 */
export async function createEvent({ clubId, title, eventType, durationMin, description, userClubIds }) {
  if (!clubId || !userClubIds.includes(parseInt(clubId, 10))) {
    const error = new Error('You are not authorized to create events for this club.');
    error.status = 403;
    error.code = 'FORBIDDEN_CLUB_ACTION';
    throw error;
  }

  if (!title || !title.trim()) {
    const error = new Error('Event title is required.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const parsedDuration = parseInt(durationMin, 10);
  if (!parsedDuration || parsedDuration <= 0) {
    const error = new Error('Event duration must be a positive number of minutes.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const event = await queries.createEvent({
    clubId: parseInt(clubId, 10),
    title,
    eventType: eventType || 'CULTURAL',
    durationMin: parsedDuration,
    description,
  });

  return { event };
}

/**
 * Updates an existing event (BR11)
 */
export async function updateEvent(eventId, { title, eventType, durationMin, description, userClubIds }) {
  const existing = await queries.getEventById(eventId);
  if (!existing) {
    const error = new Error('Event not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!userClubIds.includes(existing.club_id)) {
    const error = new Error('You are not authorized to edit events for this club.');
    error.status = 403;
    error.code = 'FORBIDDEN_CLUB_ACTION';
    throw error;
  }

  const updated = await queries.updateEvent(eventId, {
    title,
    eventType,
    durationMin,
    description,
  });

  return { event: updated };
}

/**
 * Schedules a new show for an event
 * Supports Auditorium or Classroom (with custom room number and capacity)
 * Supports Audience Access restrictions: STUDENT, FACULTY, GUEST, etc.
 * Triggers enforce BR2 (venue overlap GiST) and BR13 (show duration >= event duration)
 */
export async function createShow({
  eventId,
  venueType,
  venueId,
  roomNumber,
  capacity,
  allowedAttendees,
  startTime,
  endTime,
  prices,
  basePrice,
  userClubIds,
}) {
  const event = await queries.getEventById(eventId);
  if (!event) {
    const error = new Error('Event not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!userClubIds.includes(event.club_id)) {
    const error = new Error('You are not authorized to schedule shows for this event.');
    error.status = 403;
    error.code = 'FORBIDDEN_CLUB_ACTION';
    throw error;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Invalid start_time or end_time format.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  if (end <= start) {
    const error = new Error('Show end_time must be strictly after start_time.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  // 1. Resolve venue
  let targetVenueId = venueId ? parseInt(venueId, 10) : null;
  const isClassroom = (venueType || '').toUpperCase() === 'CLASSROOM' || (!targetVenueId && roomNumber);

  if (isClassroom && roomNumber && roomNumber.trim()) {
    const venue = await queries.getOrCreateClassroomVenue({
      roomNumber: roomNumber.trim(),
      capacity: capacity ? parseInt(capacity, 10) : 60,
    });
    targetVenueId = venue.venue_id;
  }

  if (!targetVenueId) {
    const error = new Error('Please select or specify a valid venue for the show.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  // 2. Normalize allowed attendees
  let normalizedAttendees = ['STUDENT', 'FACULTY', 'GUEST'];
  if (Array.isArray(allowedAttendees) && allowedAttendees.length > 0) {
    const filtered = allowedAttendees
      .map((t) => (t || '').toString().trim().toUpperCase())
      .filter((t) => ['STUDENT', 'FACULTY', 'GUEST'].includes(t));
    if (filtered.length > 0) {
      normalizedAttendees = filtered;
    }
  }

  // 3. Insert show (Database triggers ex_show_venue_overlap and fn_check_show_duration will validate)
  const createdShow = await queries.createShow({
    eventId: parseInt(eventId, 10),
    venueId: targetVenueId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    allowedAttendees: normalizedAttendees,
  });

  // 4. Configure initial prices if provided or default so show is immediately bookable
  const venues = await queries.getVenuesWithCategories();
  const currentVenue = venues.find((v) => v.venue_id === targetVenueId);
  const categories = currentVenue?.categories || [];

  if (Array.isArray(prices) && prices.length > 0) {
    await withTransaction(async (client) => {
      for (const item of prices) {
        if (item.category_id && item.user_type && item.price !== undefined) {
          await queries.upsertShowPrice(client, {
            showId: createdShow.show_id,
            categoryId: parseInt(item.category_id, 10),
            userType: item.user_type.toUpperCase(),
            price: parseFloat(item.price),
          });
        }
      }
    });
  } else if (categories.length > 0) {
    // Seed default prices for allowed attendee types
    await withTransaction(async (client) => {
      for (const cat of categories) {
        for (const type of normalizedAttendees) {
          let priceVal = 50.0;
          if (basePrice && basePrice[type.toLowerCase()] !== undefined) {
            priceVal = parseFloat(basePrice[type.toLowerCase()]);
          } else {
            // Sensible defaults
            if (type === 'STUDENT') priceVal = cat.name.toLowerCase().includes('gold') ? 50.0 : 20.0;
            if (type === 'FACULTY') priceVal = cat.name.toLowerCase().includes('gold') ? 100.0 : 50.0;
            if (type === 'GUEST') priceVal = cat.name.toLowerCase().includes('gold') ? 150.0 : 80.0;
          }
          await queries.upsertShowPrice(client, {
            showId: createdShow.show_id,
            categoryId: cat.category_id,
            userType: type,
            price: priceVal,
          });
        }
      }
    });
  }

  const showDetail = await queries.getShowById(createdShow.show_id);

  return {
    show: showDetail,
    message: 'Show scheduled successfully.',
  };
}

/**
 * Cancels a show (Workflow W4)
 * Triggers BR10 cascade: automatically cancels all pending/confirmed bookings and refunds payments
 */
export async function cancelShow(showId, userClubIds) {
  const show = await queries.getShowById(showId);
  if (!show) {
    const error = new Error('Show not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!userClubIds.includes(show.club_id)) {
    const error = new Error('You are not authorized to cancel shows for this club.');
    error.status = 403;
    error.code = 'FORBIDDEN_CLUB_ACTION';
    throw error;
  }

  if (show.status === 'CANCELLED') {
    return {
      show,
      message: 'Show is already cancelled.',
    };
  }

  const updatedShow = await queries.cancelShow(showId);

  return {
    show: updatedShow,
    message: 'Show cancelled successfully. All attendee bookings have been cancelled and payments refunded.',
  };
}

/**
 * Configures the price grid for a show (BR12)
 * Trigger trg_show_price_venue_category validates category belongs to the show's venue
 */
export async function configureShowPrices(showId, prices, userClubIds) {
  const show = await queries.getShowById(showId);
  if (!show) {
    const error = new Error('Show not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!userClubIds.includes(show.club_id)) {
    const error = new Error('You are not authorized to set prices for this show.');
    error.status = 403;
    error.code = 'FORBIDDEN_CLUB_ACTION';
    throw error;
  }

  if (!Array.isArray(prices) || prices.length === 0) {
    const error = new Error('Prices array cannot be empty.');
    error.status = 422;
    error.code = 'INVALID_INPUT';
    throw error;
  }

  await withTransaction(async (client) => {
    for (const item of prices) {
      const categoryId = parseInt(item.category_id, 10);
      const userType = (item.user_type || '').toUpperCase();
      const price = parseFloat(item.price);

      if (isNaN(price) || price < 0) {
        const err = new Error('Ticket price must be a non-negative number.');
        err.status = 422;
        err.code = 'INVALID_INPUT';
        throw err;
      }

      await queries.upsertShowPrice(client, {
        showId: parseInt(showId, 10),
        categoryId,
        userType,
        price,
      });
    }
  });

  const updatedPrices = await queries.getShowPrices(showId);
  return {
    show_id: parseInt(showId, 10),
    prices: updatedPrices.map((p) => ({
      ...p,
      price: parseFloat(p.price),
    })),
  };
}
