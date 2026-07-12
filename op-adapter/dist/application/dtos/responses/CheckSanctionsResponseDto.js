export default class CheckSanctionsResponseDto {
    meta;
    query;
    search_params;
    hits_count;
    data;
    constructor({ meta, query, searchParams, hitsCount, data }) {
        this.meta = meta;
        this.query = query;
        this.search_params = searchParams;
        this.hits_count = hitsCount;
        this.data = data;
    }
    /**
     * Creates response DTO from service results and request data.
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
