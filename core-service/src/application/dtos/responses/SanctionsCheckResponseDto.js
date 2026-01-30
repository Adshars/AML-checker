/**
 * Sanctions Check Response DTO
 */
export class SanctionsCheckResponseDto {
  constructor({
    hitsCount,
    data,
    meta
  }) {
    this.hits_count = hitsCount;
    this.data = data;
    this.meta = meta;
  }

  static fromAdapterResponse(adapterResponse) {
    return new SanctionsCheckResponseDto({
      hitsCount: adapterResponse.hits_count || 0,
      data: adapterResponse.data || [],
      meta: adapterResponse.meta || {}
    });
  }

  toJSON() {
    return {
      hits_count: this.hits_count,
      data: this.data,
      meta: this.meta
    };
  }
}

export default SanctionsCheckResponseDto;
