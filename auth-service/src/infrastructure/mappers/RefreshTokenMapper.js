import { RefreshToken } from '../../domain/entities/RefreshToken.js';

/**
 * Maps between RefreshToken domain entity and MongoDB document
 */
export class RefreshTokenMapper {
  /**
   * Convert MongoDB document to domain entity
   * @param {Object} doc - MongoDB document
   * @returns {RefreshToken|null}
   */
  static toDomain(doc) {
    if (!doc) return null;

    return new RefreshToken({
      id: doc._id.toString(),
      token: doc.token,
      userId: doc.userId?.toString(),
      createdAt: doc.createdAt
    });
  }

  /**
   * Convert domain entity to persistence format
   * @param {RefreshToken} entity - Domain entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    return {
      token: entity.token,
      userId: entity.userId,
      createdAt: entity.createdAt || new Date()
    };
  }
}

export default RefreshTokenMapper;
