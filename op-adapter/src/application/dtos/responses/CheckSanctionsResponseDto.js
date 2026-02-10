/**
 * CheckSanctionsResponseDto
 * Formats sanctions check response for API output.
 */
export default class CheckSanctionsResponseDto {
  constructor({ meta, query, searchParams, hitsCount, data }) {
    this.meta = meta;
    this.query = query;
    this.search_params = searchParams;
    this.hits_count = hitsCount;
    this.data = data;
  }

  /**
   * Creates response DTO from service results and request data.
   * @param {Object} params - Response parameters
   * @param {string} params.query - Original search query (name)
   * @param {Object} params.searchParams - Search parameters used
   * @param {Array} params.results - Array of SanctionEntity objects
   * @param {Object} params.stats - Stats from service (hitsCount, source, requestId)
   * @returns {CheckSanctionsResponseDto} Formatted response DTO
   */
  static fromServiceResult({ query, searchParams, results, stats }) {
    return new CheckSanctionsResponseDto({
      meta: {
        source: stats.source || 'OpenSanctions (Local Yente)',
        timestamp: new Date().toISOString(),
        requestId: stats.requestId,
      },
      query,
      searchParams,
      hitsCount: stats.hitsCount,
      data: results,
    });
  }

  /**
   * Converts DTO to JSON-serializable object for API response.
   * @returns {Object} Plain object for JSON serialization
   */
  toJSON() {
    return {
      meta: this.meta,
      query: this.query,
      search_params: this.search_params,
      hits_count: this.hits_count,
      data: this.data,
    };
  }
}
