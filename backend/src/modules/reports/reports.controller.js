// ─────────────────────────────────────────────────────────────
// backend/src/modules/reports/reports.controller.js
// Express controllers handling report query requests
// ─────────────────────────────────────────────────────────────

import * as reportsService from './reports.service.js';

export async function getSummary(req, res, next) {
  try {
    const data = await reportsService.getSummaryReport(req.user.clubIds, req.query.clubId);
    res.json({ summary: data });
  } catch (err) {
    next(err);
  }
}

export async function getOccupancy(req, res, next) {
  try {
    const data = await reportsService.getOccupancyReport(req.user.clubIds, {
      clubId: req.query.clubId,
      eventId: req.query.eventId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });
    res.json({ occupancy: data });
  } catch (err) {
    next(err);
  }
}

export async function getRevenue(req, res, next) {
  try {
    const data = await reportsService.getRevenueReport(req.user.clubIds, {
      clubId: req.query.clubId,
      eventId: req.query.eventId,
    });
    res.json({ revenue: data });
  } catch (err) {
    next(err);
  }
}

export async function getTopEvents(req, res, next) {
  try {
    const data = await reportsService.getTopEventsReport(req.user.clubIds, req.query.clubId);
    res.json({ topEvents: data });
  } catch (err) {
    next(err);
  }
}

export async function getUnsoldShows(req, res, next) {
  try {
    const data = await reportsService.getUnsoldShowsReport(req.user.clubIds, req.query.clubId);
    res.json({ unsoldShows: data });
  } catch (err) {
    next(err);
  }
}

export async function getActiveAttendees(req, res, next) {
  try {
    const data = await reportsService.getActiveAttendeesReport(req.user.clubIds, {
      clubId: req.query.clubId,
      minBookings: req.query.minBookings,
    });
    res.json({ activeAttendees: data });
  } catch (err) {
    next(err);
  }
}

export async function getRowUtilization(req, res, next) {
  try {
    const data = await reportsService.getRowUtilizationReport(req.user.clubIds, req.query.clubId);
    res.json({ rowUtilization: data });
  } catch (err) {
    next(err);
  }
}
