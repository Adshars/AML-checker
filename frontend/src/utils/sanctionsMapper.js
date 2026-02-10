import { MATCH_STATUS, TOPIC } from '../constants/sanctions';

/**
 * Extract the best Latin-script name from an entity hit.
 * Checks properties.name array first, then falls back to top-level fields.
 */
export function getLatinName(hit) {
  if (!hit) return 'Unknown Entity';

  const names = hit.properties?.name;

  if (Array.isArray(names) && names.length > 0) {
    const latinName = names.find(n => /[a-zA-Z]/.test(n));
    return latinName || names[0];
  }

  return hit.name || hit.caption || 'Unknown Entity';
}

/**
 * Map a raw API entity hit to a clean domain object.
 */
export function normalizeEntity(hit) {
  const topics = hit.properties?.topics ?? [];

  return {
    id: hit.id,
    name: getLatinName(hit),
    isSanctioned: topics.includes(TOPIC.SANCTION),
    isPep: topics.includes(TOPIC.PEP),
    score: typeof hit.score === 'number' ? hit.score : null,
    countries: Array.isArray(hit.country) ? hit.country : [],
    raw: hit,
  };
}

/**
 * Normalize the full API response into a consistent shape.
 * Handles various response structures (data, results, hits).
 */
export function normalizeApiResponse(apiResult) {
  const hits = apiResult?.data || apiResult?.results || apiResult?.hits || [];
  const hitsArray = Array.isArray(hits) ? hits : [];

  const matchStatus = apiResult?.result
    || (hitsArray.length > 0 ? MATCH_STATUS.HIT : MATCH_STATUS.CLEAN);

  return {
    matchStatus,
    entities: hitsArray.map(normalizeEntity),
  };
}
