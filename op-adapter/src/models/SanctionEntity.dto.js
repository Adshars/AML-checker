/**
 * SanctionEntity DTO
 * Maps Yente API response to simplified, flat structure for downstream services.
 * Extracts sanctioning flags (isSanctioned, isPep) from topics array.
 */
export default class SanctionEntity {
  constructor({
    id,
    name,
    schema,
    score,
    isSanctioned,
    isPep,
    birthDate,
    birthPlace,
    gender,
    nationality,
    country,
    position,
    notes,
    alias,
    address,
    datasets,
  }) {
    this.id = id;
    this.name = name;
    this.schema = schema;
    this.score = score;
    this.isSanctioned = isSanctioned;
    this.isPep = isPep;
    this.birthDate = birthDate;
    this.birthPlace = birthPlace;
    this.gender = gender;
    this.nationality = nationality;
    this.country = country;
    this.position = position;
    this.notes = notes;
    this.alias = alias;
    this.address = address;
    this.datasets = datasets;
  }

  /**
   * Factory method to create SanctionEntity from Yente API response item.
   * Safely extracts all fields with null/empty defaults.
   * @param {Object} item - Raw Yente API result item
   * @returns {SanctionEntity} Mapped entity with flat structure
   */
  static fromYenteResponse(item) {
    const props = item.properties || {};
    const topics = props.topics || [];

    return new SanctionEntity({
      id: item.id || null,
      name: props.name?.[0] || item.caption || 'Unknown',
      schema: item.schema || null,
      score: item.score ?? 0,
      isSanctioned: topics.includes('sanction'),
      isPep: topics.includes('role.pep'),
      birthDate: props.birthDate?.[0] || null,
      birthPlace: props.birthPlace?.[0] || null,
      gender: props.gender?.[0] || null,
      nationality: props.nationality || [],
      country: props.country || [],
      position: props.position || [],
      notes: props.notes || [],
      alias: props.alias || [],
      address: props.address || [],
      datasets: item.datasets || [],
    });
  }

  /**
   * Convert entity to plain JSON object for API response.
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      schema: this.schema,
      score: this.score,
      isSanctioned: this.isSanctioned,
      isPep: this.isPep,
      birthDate: this.birthDate,
      birthPlace: this.birthPlace,
      gender: this.gender,
      nationality: this.nationality,
      country: this.country,
      position: this.position,
      notes: this.notes,
      alias: this.alias,
      address: this.address,
      datasets: this.datasets,
    };
  }
}
