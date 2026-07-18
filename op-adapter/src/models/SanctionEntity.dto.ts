/**
 * SanctionEntity DTO
 * Maps Yente API response while preserving original properties for frontend.
 * Extracts direct flags (isSanctioned, isPep) for downstream services.
 */

export interface YenteResponseItem {
  id?: string | null;
  caption?: string | null;
  schema?: string | null;
  score?: number | null;
  datasets?: string[];
  properties?: {
    name?: string[];
    topics?: string[];
    birthDate?: string[];
    country?: string[];
    [key: string]: unknown;
  };
}

export interface SanctionEntityParams {
  id: string | null;
  caption: string | null;
  name: string;
  schema: string | null;
  score: number;
  isSanctioned: boolean;
  isPep: boolean;
  birthDate: string | null;
  country: string[];
  datasets: string[];
  properties: Record<string, unknown>;
}

export default class SanctionEntity {
  id: string | null;
  caption: string | null;
  name: string;
  schema: string | null;
  score: number;
  isSanctioned: boolean;
  isPep: boolean;
  birthDate: string | null;
  country: string[];
  datasets: string[];
  properties: Record<string, unknown>;

  constructor({
    id,
    caption,
    name,
    schema,
    score,
    isSanctioned,
    isPep,
    birthDate,
    country,
    datasets,
    properties,
  }: SanctionEntityParams) {
    this.id = id;
    this.caption = caption;
    this.name = name;
    this.schema = schema;
    this.score = score;
    this.isSanctioned = isSanctioned;
    this.isPep = isPep;
    this.birthDate = birthDate;
    this.country = country;
    this.datasets = datasets;
    this.properties = properties;
  }

  /**
   * Factory method to create SanctionEntity from Yente API response item.
   * Preserves original properties object for frontend while extracting
   * direct flags for core-service consumption.
   */
  static fromYenteResponse(item: YenteResponseItem): SanctionEntity {
    const props = item.properties || {};
    const topics = props.topics || [];

    return new SanctionEntity({
      id: item.id || null,
      caption: item.caption || null,
      name: props.name?.[0] || item.caption || 'Unknown',
      schema: item.schema || null,
      score: item.score ?? 0,
      isSanctioned: topics.includes('sanction'),
      isPep: topics.includes('role.pep'),
      birthDate: props.birthDate?.[0] || null,
      country: props.country || [],
      datasets: item.datasets || [],
      properties: props,
    });
  }

  /**
   * Convert entity to plain JSON object for API response.
   * Includes both direct flags and original properties object.
   */
  toJSON() {
    return {
      id: this.id,
      caption: this.caption,
      name: this.name,
      schema: this.schema,
      score: this.score,
      isSanctioned: this.isSanctioned,
      isPep: this.isPep,
      birthDate: this.birthDate,
      country: this.country,
      datasets: this.datasets,
      properties: this.properties,
    };
  }
}
