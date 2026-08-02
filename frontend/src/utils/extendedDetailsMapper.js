// Technical fields to hide from both the UI table and the PDF export.
export const IGNORED_KEYS = [
  'addressEntity', 'sourceUrl', 'programId', 'topics',
  'entityId', 'schema', 'type', 'last_change', 'first_seen',
  'datasets', 'id', 'caption', 'target'
];

// Display order (logical grouping), shared between the UI table and the PDF export.
export const PRIORITY_KEYS = [
  // 1. Basic identity
  'name',
  'firstName',
  'middleName',
  'lastName',
  'fatherName',
  'motherName',
  'gender',
  'title',

  // 2. Birth and death
  'birthDate',
  'birthPlace',
  'deathDate',

  // 3. Legal status and location
  'nationality',
  'citizenship',
  'country',
  'jurisdiction',

  // 4. Occupation and role
  'position',
  'education',
  'religion',
  'political',
  'status',

  // 5. Contact details and identifiers (last, can be long)
  'address',
  'website',
  'email',
  'phone',
  'taxNumber',
  'passportNumber',

  // 6. Other (large lists)
  'alias',
  'weakAlias',
  'notes'
];

// camelCase -> Title Case (e.g. birthPlace -> Birth Place)
export const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

/**
 * Filters and sorts hitDetails into [key, value] entries, ready to render
 * as a label/value table. Shared by ExtendedDetails.jsx (React) and the PDF
 * export module, so both stay in sync.
 */
export const getExtendedDetailsEntries = (data) => {
  if (!data || Object.keys(data).length === 0) return [];

  const entries = Object.entries(data).filter(([key, value]) => {
    if (IGNORED_KEYS.includes(key)) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  entries.sort(([keyA], [keyB]) => {
    const indexA = PRIORITY_KEYS.indexOf(keyA);
    const indexB = PRIORITY_KEYS.indexOf(keyB);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return keyA.localeCompare(keyB);
  });

  return entries;
};
