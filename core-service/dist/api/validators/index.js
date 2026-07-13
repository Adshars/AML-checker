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
        res.status(400).json({ error: 'Missing name parameter' });
        return;
    }
    if (!orgId) {
        res.status(403).json({ error: 'Missing Organization Context (x-org-id)' });
        return;
    }
    next();
};
/**
 * Validate organization context for stats
 */
export const validateOrgContext = (req, res, next) => {
    const orgId = req.headers['x-org-id'];
    if (!orgId) {
        res.status(400).json({ error: 'Missing organization ID' });
        return;
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
        next();
        return;
    }
    // Non-superadmin requires org context
    if (!orgId) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }
    next();
};
