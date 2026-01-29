import { User } from '../../domain/entities/User.js';

/**
 * Maps between User domain entity and MongoDB document
 */
export class UserMapper {
  /**
   * Convert MongoDB document to domain entity
   * @param {Object} doc - MongoDB document
   * @returns {User|null}
   */
  static toDomain(doc) {
    if (!doc) return null;

    return new User({
      id: doc._id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      firstName: doc.firstName,
      lastName: doc.lastName,
      organizationId: doc.organizationId?.toString(),
      role: doc.role,
      createdAt: doc.createdAt
    });
  }

  /**
   * Convert domain entity to persistence format
   * @param {User} entity - Domain entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    const doc = {
      email: entity.email,
      passwordHash: entity.passwordHash,
      firstName: entity.firstName,
      lastName: entity.lastName,
      organizationId: entity.organizationId,
      role: entity.role
    };

    if (entity.createdAt) {
      doc.createdAt = entity.createdAt;
    }

    return doc;
  }

  /**
   * Convert domain entity to response format (without sensitive data)
   * @param {User} entity - Domain entity
   * @returns {Object}
   */
  static toResponse(entity) {
    if (!entity) return null;

    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      organizationId: entity.organizationId,
      role: entity.role,
      createdAt: entity.createdAt
    };
  }
}

export default UserMapper;
