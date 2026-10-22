// ─────────────────────────────────────────────────────────────
// backend/src/modules/organizer/organizer.controller.js
// Express request handlers for club manager organizer workflow (W4)
// ─────────────────────────────────────────────────────────────

import * as organizerService from './organizer.service.js';

/**
 * GET /api/v1/organizer/venues
 */
export async function getVenues(req, res, next) {
  try {
    const result = await organizerService.listVenues();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizer/events
 */
export async function getEvents(req, res, next) {
  try {
    const clubIds = req.user.clubIds || [];
    const result = await organizerService.listClubEvents(clubIds);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizer/events
 */
export async function createEvent(req, res, next) {
  try {
    const { club_id, title, event_type, duration_min, description } = req.body;
    const userClubIds = req.user.clubIds || [];

    const result = await organizerService.createEvent({
      clubId: club_id,
      title,
      eventType: event_type,
      durationMin: duration_min,
      description,
      userClubIds,
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/organizer/events/:id
 */
export async function updateEvent(req, res, next) {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { title, event_type, duration_min, description } = req.body;
    const userClubIds = req.user.clubIds || [];

    const result = await organizerService.updateEvent(eventId, {
      title,
      eventType: event_type,
      durationMin: duration_min,
      description,
      userClubIds,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizer/shows
 */
export async function getShows(req, res, next) {
  try {
    const clubIds = req.user.clubIds || [];
    const result = await organizerService.listClubShows(clubIds);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizer/venues/classroom
 */
export async function createClassroomVenue(req, res, next) {
  try {
    const { room_number, name, capacity } = req.body;
    const result = await organizerService.createClassroomVenue({
      roomNumber: room_number || name,
      capacity,
    });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizer/shows
 */
export async function createShow(req, res, next) {
  try {
    const {
      event_id,
      venue_id,
      venue_type,
      room_number,
      capacity,
      allowed_attendees,
      start_time,
      end_time,
      prices,
      base_price,
    } = req.body;
    const userClubIds = req.user.clubIds || [];

    const result = await organizerService.createShow({
      eventId: event_id,
      venueId: venue_id,
      venueType: venue_type,
      roomNumber: room_number,
      capacity,
      allowedAttendees: allowed_attendees,
      startTime: start_time,
      endTime: end_time,
      prices,
      basePrice: base_price,
      userClubIds,
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizer/shows/:id/cancel
 */
export async function cancelShow(req, res, next) {
  try {
    const showId = parseInt(req.params.id, 10);
    const userClubIds = req.user.clubIds || [];

    const result = await organizerService.cancelShow(showId, userClubIds);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/organizer/shows/:id/prices
 */
export async function updateShowPrices(req, res, next) {
  try {
    const showId = parseInt(req.params.id, 10);
    const { prices } = req.body;
    const userClubIds = req.user.clubIds || [];

    const result = await organizerService.configureShowPrices(showId, prices, userClubIds);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
