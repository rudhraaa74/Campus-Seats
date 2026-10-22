// ─────────────────────────────────────────────────────────────
// backend/src/middleware/requireClubManager.js
// BR11: Ensures only authorized managers of a specific club can edit its events
// ─────────────────────────────────────────────────────────────

export function requireClubManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
    });
  }

  const userClubIds = req.user.clubIds || [];
  if (userClubIds.length === 0) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only club managers are authorized to perform organizer operations.',
      },
    });
  }

  const targetClubId = parseInt(req.body.club_id || req.params.clubId || req.query.club_id, 10);

  if (targetClubId && !userClubIds.includes(targetClubId)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_CLUB_ACTION',
        message: 'You are not an authorized manager of this club.',
      },
    });
  }

  next();
}
