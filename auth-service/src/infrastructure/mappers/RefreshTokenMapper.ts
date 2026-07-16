import { RefreshToken } from '../../domain/entities/RefreshToken.js';
import type { RefreshTokenDocument } from '../database/mongoose/schemas/RefreshTokenSchema.js';

export interface RefreshTokenPersistence {
  token: string;
  userId: string;
  createdAt: Date;
}

/**
 * Maps between RefreshToken domain entity and MongoDB document
 */
export class RefreshTokenMapper {
  /**
   * Convert MongoDB document to domain entity
   */
  static toDomain(doc: RefreshTokenDocument | null | undefined): RefreshToken | null {
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
   */
  static toPersistence(entity: RefreshToken): RefreshTokenPersistence {
    return {
      token: entity.token,
      userId: entity.userId,
      createdAt: entity.createdAt || new Date()
    };
  }
}

export default RefreshTokenMapper;
