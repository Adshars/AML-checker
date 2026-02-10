/**
 * SanctionEntity DTO
 * Maps Yente API response while preserving original properties for frontend.
 * Extracts direct flags (isSanctioned, isPep) for downstream services.
 */
export default class SanctionEntity {
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
  }) {
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
   * @param {Object} item - Raw Yente API result item
   * @returns {SanctionEntity} Mapped entity
   */
  static fromYenteResponse(item) {
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
   * @returns {Object} Plain object representation
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
