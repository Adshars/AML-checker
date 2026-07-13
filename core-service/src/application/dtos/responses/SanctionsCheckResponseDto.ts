export interface AdapterCheckResponse {
  hits_count?: number;
  data?: unknown[];
  meta?: Record<string, unknown>;
}

export interface SanctionsCheckResponseDtoParams {
  hitsCount: number;
  data: unknown[];
  meta: Record<string, unknown>;
}

/**
 * Sanctions Check Response DTO
 */
export class SanctionsCheckResponseDto {
  hits_count: number;
  data: unknown[];
  meta: Record<string, unknown>;

  constructor({
    hitsCount,
    data,
    meta
  }: SanctionsCheckResponseDtoParams) {
    this.hits_count = hitsCount;
    this.data = data;
    this.meta = meta;
  }

  static fromAdapterResponse(adapterResponse: AdapterCheckResponse): SanctionsCheckResponseDto {
    return new SanctionsCheckResponseDto({
      hitsCount: adapterResponse.hits_count || 0,
      data: adapterResponse.data || [],
      meta: adapterResponse.meta || {}
    });
  }

  toJSON(): { hits_count: number; data: unknown[]; meta: Record<string, unknown> } {
    return {
      hits_count: this.hits_count,
      data: this.data,
      meta: this.meta
    };
  }
}

export default SanctionsCheckResponseDto;
