// ─────────────────────────────────────────────────────────────
// backend/src/modules/reports/reports.service.js
// Business logic and data aggregation for manager reports
// ─────────────────────────────────────────────────────────────

import { pool } from '../../db/pool.js';
import { reportsQueries } from './reports.queries.js';

function resolveClubScope(userClubIds, requestedClubId) {
  if (!userClubIds || userClubIds.length === 0) {
    const err = new Error('User does not have manager privileges for any club.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (requestedClubId) {
    const parsed = parseInt(requestedClubId, 10);
    if (!userClubIds.includes(parsed)) {
      const err = new Error('You do not have manager permissions for the requested club.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return [parsed];
  }

  return userClubIds;
}

export async function getSummaryReport(userClubIds, requestedClubId) {
  const clubScope = resolveClubScope(userClubIds, requestedClubId);
  const result = await pool.query(reportsQueries.getSummaryKpis, [clubScope]);
  
  if (result.rows.length === 0) {
    return {
      total_shows: 0,
      total_events: 0,
      confirmed_tickets: 0,
      held_tickets: 0,
      total_revenue: '0.00',
      avg_occupancy_pct: '0.00',
    };
  }
  
  return result.rows[0];
}

export async function getOccupancyReport(userClubIds, { clubId, eventId, dateFrom, dateTo }) {
  const clubScope = resolveClubScope(userClubIds, clubId);
  const eventParam = eventId ? parseInt(eventId, 10) : null;
  const dateFromParam = dateFrom ? new Date(dateFrom).toISOString() : null;
  const dateToParam = dateTo ? new Date(dateTo).toISOString() : null;

  const result = await pool.query(reportsQueries.getShowOccupancy, [
    clubScope,
    eventParam,
    dateFromParam,
    dateToParam,
  ]);

  return result.rows;
}

export async function getRevenueReport(userClubIds, { clubId, eventId }) {
  const clubScope = resolveClubScope(userClubIds, clubId);
  const eventParam = eventId ? parseInt(eventId, 10) : null;

  const result = await pool.query(reportsQueries.getRevenueBreakdown, [clubScope, eventParam]);
  return result.rows;
}

export async function getTopEventsReport(userClubIds, requestedClubId) {
  const clubScope = resolveClubScope(userClubIds, requestedClubId);
  const result = await pool.query(reportsQueries.getTopEvents, [clubScope]);
  return result.rows;
}

export async function getUnsoldShowsReport(userClubIds, requestedClubId) {
  const clubScope = resolveClubScope(userClubIds, requestedClubId);
  const result = await pool.query(reportsQueries.getUnsoldShows, [clubScope]);
  return result.rows;
}

export async function getActiveAttendeesReport(userClubIds, { clubId, minBookings }) {
  const clubScope = resolveClubScope(userClubIds, clubId);
  const minBookingsParam = minBookings ? parseInt(minBookings, 10) : 1;

  const result = await pool.query(reportsQueries.getActiveAttendees, [clubScope, minBookingsParam]);
  return result.rows;
}

export async function getRowUtilizationReport(userClubIds, requestedClubId) {
  const clubScope = resolveClubScope(userClubIds, requestedClubId);
  const result = await pool.query(reportsQueries.getRowUtilization, [clubScope]);
  return result.rows;
}
