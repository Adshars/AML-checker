/**
 * Organization Repository Interface
 * Defines the contract for organization data access
 */
export class IOrganizationRepository {
    /**
     * Find organization by ID
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }
    /**
     * Find organization by name
     */
    async findByName(name) {
        throw new Error('Method not implemented');
    }
    /**
     * Find organization by API key
     */
    async findByApiKey(apiKey) {
        throw new Error('Method not implemented');
    }
    /**
     * Create a new organization
     */
    async create(organization) {
        throw new Error('Method not implemented');
    }
    /**
     * Update organization
     */
    async update(id, updates) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete organization by ID
     */
    async delete(id) {
        throw new Error('Method not implemented');
    }
    /**
     * Check if organization name exists
     */
    async existsByName(name) {
        throw new Error('Method not implemented');
    }
}
export default IOrganizationRepository;
