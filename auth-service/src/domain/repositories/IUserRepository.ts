import type { User, UserProps } from '../entities/User.js';

export interface FindByOrganizationOptions {
  excludeRoles?: string[];
  excludeFields?: string[];
}

/**
 * User Repository Interface
 * Defines the contract for user data access
 */
export class IUserRepository {
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find all users by organization ID
   */
  async findByOrganizationId(organizationId: string, options: FindByOrganizationOptions = {}): Promise<User[]> {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new user
   */
  async create(user: User): Promise<User> {
    throw new Error('Method not implemented');
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<UserProps>): Promise<User | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  /**
   * Check if email exists
   */
  async existsByEmail(email: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

export default IUserRepository;
