/**
 * User Repository Interface
 * Defines the contract for user data access
 */
export class IUserRepository {
    /**
     * Find user by ID
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }
    /**
     * Find user by email
     */
    async findByEmail(email) {
        throw new Error('Method not implemented');
    }
    /**
     * Find all users by organization ID
     */
    async findByOrganizationId(organizationId, options = {}) {
        throw new Error('Method not implemented');
    }
    /**
     * Create a new user
     */
    async create(user) {
        throw new Error('Method not implemented');
    }
    /**
     * Update user
     */
    async update(id, updates) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete user by ID
     */
    async delete(id) {
        throw new Error('Method not implemented');
    }
    /**
     * Check if email exists
     */
    async existsByEmail(email) {
        throw new Error('Method not implemented');
    }
}
export default IUserRepository;
