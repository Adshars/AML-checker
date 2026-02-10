import { useState } from 'react';
import coreService from '../services/coreService';
import { normalizeApiResponse } from '../utils/sanctionsMapper';

/**
 * Custom hook encapsulating sanctions screening logic.
 * Manages loading/error/results state and calls coreService + mapper.
 *
 * @returns {{ loading, error, results, checkEntity, clearResults }}
 *   - results: null | { matchStatus: string, entities: NormalizedEntity[] }
 */
export default function useSanctionsCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const checkEntity = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name field is required.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const apiResult = await coreService.checkEntity({ name: trimmed, fuzzy: true, limit: 10 });
      setResults(normalizeApiResponse(apiResult));
    } catch (err) {
      const message = err?.response?.data?.message
        || err?.message
        || 'An error occurred during the check.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  return { loading, error, results, checkEntity, clearResults };
}
