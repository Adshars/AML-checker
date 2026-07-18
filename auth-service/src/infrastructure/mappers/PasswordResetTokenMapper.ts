import { PasswordResetToken } from '../../domain/entities/PasswordResetToken.js';
import type { PasswordResetTokenDocument } from '../database/mongoose/schemas/PasswordResetTokenSchema.js';

export interface PasswordResetTokenPersistence {
  userId: string;
  token: string;
  createdAt: Date;
}

/**
 * Maps between PasswordResetToken domain entity and MongoDB document
 */
export class PasswordResetTokenMapper {
  /**
   * Convert MongoDB document to domain entity
   */
  static toDomain(doc: PasswordResetTokenDocument | null | undefined): PasswordResetToken | null {
    if (!doc) return null;

    return new PasswordResetToken({
      id: doc._id.toString(),
      userId: doc.userId?.toString(),
      token: doc.token,
      createdAt: doc.createdAt
    });
  }

  /**
   * Convert domain entity to persistence format
   */
  static toPersistence(entity: PasswordResetToken): PasswordResetTokenPersistence {
    return {
      userId: entity.userId,
      token: entity.token,
      createdAt: entity.createdAt || new Date()
    };
  }
}

export default PasswordResetTokenMapper;
