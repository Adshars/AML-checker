/**
 * AuditLog domain entity
 * Pure domain object without database dependencies
 */
export class AuditLog {
  constructor({
    id,
    organizationId,
    userId = null,
    userEmail = null,
    searchQuery,
    hasHit = false,
    hitsCount = 0,
    entityName = null,
    entityScore = null,
    entityBirthDate = null,
    entityGender = null,
    entityCountries = null,
    entityDatasets = null,
    entityDescription = null,
    hitDetails = null,
    isSanctioned = false,
    isPep = false,
    createdAt = new Date()
  }) {
    this.id = id;
    this.organizationId = organizationId;
    this.userId = userId;
    this.userEmail = userEmail;
    this.searchQuery = searchQuery;
    this.hasHit = hasHit;
    this.hitsCount = hitsCount;
    this.entityName = entityName;
    this.entityScore = entityScore;
    this.entityBirthDate = entityBirthDate;
    this.entityGender = entityGender;
    this.entityCountries = entityCountries;
    this.entityDatasets = entityDatasets;
    this.entityDescription = entityDescription;
    this.hitDetails = hitDetails;
    this.isSanctioned = isSanctioned;
    this.isPep = isPep;
    this.createdAt = createdAt;
  }

  /**
   * Check if this audit log has any sanctions or PEP flags
   */
  hasRiskIndicators() {
    return this.isSanctioned || this.isPep;
  }

  /**
   * Get countries as array
   */
  getCountriesArray() {
    if (!this.entityCountries) return [];
    return this.entityCountries.split(',').map(c => c.trim()).filter(Boolean);
  }

  /**
   * Get datasets as array
   */
  getDatasetsArray() {
    if (!this.entityDatasets) return [];
    return this.entityDatasets.split(',').map(d => d.trim()).filter(Boolean);
  }

  /**
   * Create from adapter response data
   * Handles both property-based format (OpenSanctions) and flat format (legacy)
   */
  static fromCheckResult({
    organizationId,
    userId,
    userEmail,
    searchQuery,
    adapterResponse
  }) {
    const hitsCount = adapterResponse?.hits_count || 0;
    const hasHit = hitsCount > 0;
    const bestHit = adapterResponse?.data?.[0];

    let entityData = {};
    let isSanctioned = false;
    let isPep = false;

    if (bestHit) {
      const properties = bestHit.properties || {};
      const topics = properties.topics || bestHit.topics || [];

      // Check for sanctions and PEP status
      // Support both topics-based (OpenSanctions) and direct flags (legacy)
      isSanctioned = topics.some(t => t.includes('sanction'));
      isPep = topics.some(t => t.includes('role.pep'));

      // Helper to get value from properties (array) or direct field
      const getValue = (propsKey, directKey) => {
        if (properties[propsKey]?.length) {
          return properties[propsKey][0];
        }
        const directValue = bestHit[directKey || propsKey];
        // Handle arrays from direct field too
        if (Array.isArray(directValue)) {
          return directValue[0] || null;
        }
        return directValue || null;
      };

      // Helper to get array value and join as string
      const getArrayValue = (propsKey, directKey) => {
        const propsValue = properties[propsKey];
        const directValue = bestHit[directKey || propsKey];

        if (Array.isArray(propsValue) && propsValue.length) {
          return propsValue.join(', ');
        }
        if (Array.isArray(directValue) && directValue.length) {
          return directValue.join(', ');
        }
        return null;
      };

      entityData = {
        entityName: getValue('name', 'name'),
        entityScore: bestHit.score || null,
        entityBirthDate: getValue('birthDate', 'birthDate'),
        entityGender: getValue('gender', 'gender'),
        entityCountries: getArrayValue('country', 'country'),
        entityDatasets: getArrayValue('datasets', 'datasets'),
        entityDescription: getValue('notes', 'description'),
        hitDetails: Object.keys(properties).length > 0 ? properties : bestHit
      };
    }

    return new AuditLog({
      organizationId,
      userId,
      userEmail,
      searchQuery,
      hasHit,
      hitsCount,
      ...entityData,
      isSanctioned,
      isPep
    });
  }
}

export default AuditLog;
