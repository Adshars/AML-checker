export interface AuditLogProps {
  id?: string;
  organizationId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  searchQuery: string;
  hasHit?: boolean;
  hitsCount?: number;
  entityName?: string | null;
  entityScore?: number | null;
  entityBirthDate?: string | null;
  entityGender?: string | null;
  entityCountries?: string | null;
  entityDatasets?: string | null;
  entityDescription?: string | null;
  hitDetails?: Record<string, unknown> | null;
  isSanctioned?: boolean;
  isPep?: boolean;
  createdAt?: Date;
}

export interface AdapterHit {
  score?: number;
  isSanctioned?: boolean;
  isPep?: boolean;
  topics?: string[];
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AdapterCheckResult {
  hits_count?: number;
  data?: AdapterHit[];
}

export interface FromCheckResultParams {
  organizationId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  searchQuery: string;
  adapterResponse?: AdapterCheckResult;
}

/**
 * AuditLog domain entity
 * Pure domain object without database dependencies
 */
export class AuditLog {
  id?: string;
  organizationId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  searchQuery: string;
  hasHit: boolean;
  hitsCount: number;
  entityName: string | null;
  entityScore: number | null;
  entityBirthDate: string | null;
  entityGender: string | null;
  entityCountries: string | null;
  entityDatasets: string | null;
  entityDescription: string | null;
  hitDetails: Record<string, unknown> | null;
  isSanctioned: boolean;
  isPep: boolean;
  createdAt: Date;

  constructor({
    id,
    organizationId,
    userId = null,
    userName = null,
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
  }: AuditLogProps) {
    this.id = id;
    this.organizationId = organizationId;
    this.userId = userId;
    this.userName = userName;
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
  hasRiskIndicators(): boolean {
    return this.isSanctioned || this.isPep;
  }

  /**
   * Get countries as array
   */
  getCountriesArray(): string[] {
    if (!this.entityCountries) return [];
    return this.entityCountries.split(',').map(c => c.trim()).filter(Boolean);
  }

  /**
   * Get datasets as array
   */
  getDatasetsArray(): string[] {
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
    userName,
    userEmail,
    searchQuery,
    adapterResponse
  }: FromCheckResultParams): AuditLog {
    const hitsCount = adapterResponse?.hits_count || 0;
    const hasHit = hitsCount > 0;
    const bestHit = adapterResponse?.data?.[0];

    let entityData: Partial<AuditLogProps> = {};
    let isSanctioned = false;
    let isPep = false;

    if (bestHit) {
      // Check for sanctions and PEP status
      // Support both direct boolean flags (new flat structure) and topics-based (legacy)
      if (typeof bestHit.isSanctioned === 'boolean') {
        isSanctioned = bestHit.isSanctioned;
      } else {
        const properties = bestHit.properties || {};
        const topics = (properties.topics as string[] | undefined) || bestHit.topics || [];
        isSanctioned = Array.isArray(topics) && topics.some(t => t.includes('sanction'));
      }

      if (typeof bestHit.isPep === 'boolean') {
        isPep = bestHit.isPep;
      } else {
        const properties = bestHit.properties || {};
        const topics = (properties.topics as string[] | undefined) || bestHit.topics || [];
        isPep = Array.isArray(topics) && topics.some(t => t.includes('role.pep'));
      }

      const properties = bestHit.properties || {};

      // Helper to get value from properties (array) or direct field
      const getValue = (propsKey: string, directKey?: string): string | null => {
        const propsValue = properties[propsKey] as unknown[] | undefined;
        if (propsValue?.length) {
          return String(propsValue[0]);
        }
        const directValue = bestHit[directKey || propsKey];
        // Handle arrays from direct field too
        if (Array.isArray(directValue)) {
          return directValue.length ? String(directValue[0]) : null;
        }
        return directValue != null ? String(directValue) : null;
      };

      // Helper to get array value and join as string
      const getArrayValue = (propsKey: string, directKey?: string): string | null => {
        const propsValue = properties[propsKey] as unknown[] | undefined;
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
        hitDetails: Object.keys(properties).length > 0 ? properties : (bestHit as Record<string, unknown>)
      };
    }

    return new AuditLog({
      organizationId,
      userId,
      userName,
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
