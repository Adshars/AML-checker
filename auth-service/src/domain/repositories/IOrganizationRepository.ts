import type { Organization, OrganizationProps } from '../entities/Organization.js';
import type { OrganizationServices } from '../entities/OrganizationServices.js';

export interface FindAllOrganizationsParams {
  search?: string;
  page: number;
  limit: number;
}

export interface FindAllOrganizationsResult {
  items: Organization[];
  total: number;
}

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

  /**
   * List organizations (newest first), optionally filtered by name
   */
  async findAll(params: FindAllOrganizationsParams): Promise<FindAllOrganizationsResult> {
    throw new Error('Method not implemented');
  }

  /**
   * Replace organization service package
   */
  async updateServices(id: string, services: OrganizationServices): Promise<Organization | null> {
    throw new Error('Method not implemented');
  }
}

export default IOrganizationRepository;
