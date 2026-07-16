import { User } from '../../domain/entities/User.js';
import type { UserDocument } from '../database/mongoose/schemas/UserSchema.js';

export interface UserPersistence {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role: string;
  createdAt?: Date;
}

/**
 * Maps between User domain entity and MongoDB document
 */
export class UserMapper {
  /**
   * Convert MongoDB document to domain entity
   */
  static toDomain(doc: UserDocument | null | undefined): User | null {
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
   */
  static toPersistence(entity: User): UserPersistence {
    const doc: UserPersistence = {
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
   */
  static toResponse(entity: User | null | undefined): Record<string, unknown> | null {
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
