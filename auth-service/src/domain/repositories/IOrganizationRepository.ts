import type { Organization, OrganizationProps } from '../entities/Organization.js';

/**
 * Organization Repository Interface
 * Defines the contract for organization data access
 */
export class IOrganizationRepository {
  /**
   * Find organization by ID
   */
  async findById(id: string): Promise<Organization | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find organization by name
   */
  async findByName(name: string): Promise<Organization | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find organization by API key
   */
  async findByApiKey(apiKey: string): Promise<Organization | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new organization
   */
  async create(organization: Organization): Promise<Organization> {
    throw new Error('Method not implemented');
  }

  /**
   * Update organization
   */
  async update(id: string, updates: Partial<OrganizationProps>): Promise<Organization | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete organization by ID
   */
  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  /**
   * Check if organization name exists
   */
  async existsByName(name: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

export default IOrganizationRepository;
