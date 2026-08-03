// Shared formatting helpers for an audit-log record (History table, Log
// Details modal, and the PDF confirmation export all render the same
// underlying `selectedLog` object and must agree on these derivations.

/**
 * Extract a Latin-script name from an audit log's hitDetails.name array,
 * falling back to entityName.
 */
export const getLatinName = (entityName, hitDetails) => {
  if (hitDetails && Array.isArray(hitDetails.name)) {
    const latin = hitDetails.name.find((n) => /[a-zA-Z]/.test(n));
    if (latin) return latin;
    return hitDetails.name[0];
  }
  if (Array.isArray(entityName)) return entityName[0];
  return entityName || 'Unknown Entity';
};

/**
 * Format the entityDatasets field (array or string) into a display string.
 */
export const formatDatasets = (datasets) => {
  if (Array.isArray(datasets)) return datasets.join(', ');
  if (typeof datasets === 'string') return datasets;
  return '—';
};

/**
 * Resolve the display label for whoever performed the check.
 */
export const getUserLabel = (userId, userEmail, userName) => {
  if (userId === 'API') return 'API Key';
  return userName || userEmail || userId || '—';
};
