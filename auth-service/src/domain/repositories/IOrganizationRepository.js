/**
 * Organization Repository Interface
 * Defines the contract for organization data access
 */
export class IOrganizationRepository {
  /**
   * Find organization by ID
   * @param {string} id
   * @returns {Promise<Organization|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Find organization by name
   * @param {string} name
   * @returns {Promise<Organization|null>}
   */
  async findByName(name) {
    throw new Error('Method not implemented');
  }

  /**
   * Find organization by API key
   * @param {string} apiKey
   * @returns {Promise<Organization|null>}
   */
  async findByApiKey(apiKey) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new organization
   * @param {Organization} organization
   * @returns {Promise<Organization>}
   */
  async create(organization) {
    throw new Error('Method not implemented');
  }

  /**
   * Update organization
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Organization|null>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete organization by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if organization name exists
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async existsByName(name) {
    throw new Error('Method not implemented');
  }
}

export default IOrganizationRepository;
