// ─────────────────────────────────────────────────────────────
// backend/src/middleware/requireRole.js
// Enforces role-based permissions based on userType
// ─────────────────────────────────────────────────────────────

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
    }

    next();
  };
}
