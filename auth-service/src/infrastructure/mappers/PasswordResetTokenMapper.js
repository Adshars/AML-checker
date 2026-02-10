import { PasswordResetToken } from '../../domain/entities/PasswordResetToken.js';

/**
 * Maps between PasswordResetToken domain entity and MongoDB document
 */
export class PasswordResetTokenMapper {
  /**
   * Convert MongoDB document to domain entity
   * @param {Object} doc - MongoDB document
   * @returns {PasswordResetToken|null}
   */
  static toDomain(doc) {
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
   * @param {PasswordResetToken} entity - Domain entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    return {
      userId: entity.userId,
      token: entity.token,
      createdAt: entity.createdAt || new Date()
    };
  }
}

export default PasswordResetTokenMapper;
