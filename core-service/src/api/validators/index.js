/**
 * Validation helpers for core-service
 */

/**
 * Validate sanctions check request
 */
export const validateSanctionsCheck = (req, res, next) => {
  const name = req.query.name?.trim();
  const orgId = req.headers['x-org-id'];

  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }

  if (!orgId) {
    return res.status(403).json({ error: 'Missing Organization Context (x-org-id)' });
  }

  next();
};

/**
 * Validate organization context for stats
 */
export const validateOrgContext = (req, res, next) => {
  const orgId = req.headers['x-org-id'];

  if (!orgId) {
    return res.status(400).json({ error: 'Missing organization ID' });
  }

  next();
};

/**
 * Validate history access
 */
export const validateHistoryAccess = (req, res, next) => {
  const orgId = req.headers['x-org-id'];
  const role = req.headers['x-role'];

  // Superadmin can access without org context
  if (role === 'superadmin') {
    return next();
  }

  // Non-superadmin requires org context
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
};
