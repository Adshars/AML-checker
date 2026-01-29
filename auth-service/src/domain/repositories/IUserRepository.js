/**
 * User Repository Interface
 * Defines the contract for user data access
 */
export class IUserRepository {
  /**
   * Find user by ID
   * @param {string} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    throw new Error('Method not implemented');
  }

  /**
   * Find all users by organization ID
   * @param {string} organizationId
   * @param {Object} options - Query options (excludeRoles, etc.)
   * @returns {Promise<User[]>}
   */
  async findByOrganizationId(organizationId, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new user
   * @param {User} user
   * @returns {Promise<User>}
   */
  async create(user) {
    throw new Error('Method not implemented');
  }

  /**
   * Update user
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<User|null>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete user by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if email exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async existsByEmail(email) {
    throw new Error('Method not implemented');
  }
}

export default IUserRepository;
