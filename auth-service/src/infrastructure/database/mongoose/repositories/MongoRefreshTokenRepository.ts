import { IRefreshTokenRepository } from '../../../../domain/repositories/IRefreshTokenRepository.js';
import { RefreshTokenMapper } from '../../../mappers/RefreshTokenMapper.js';
import { RefreshTokenModel } from '../schemas/RefreshTokenSchema.js';
import type { RefreshToken } from '../../../../domain/entities/RefreshToken.js';

/**
 * MongoDB implementation of RefreshToken Repository
 */
export class MongoRefreshTokenRepository extends IRefreshTokenRepository {
  async findByToken(token: string): Promise<RefreshToken | null> {
    const doc = await RefreshTokenModel.findOne({ token });
    return RefreshTokenMapper.toDomain(doc);
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const docs = await RefreshTokenModel.find({ userId });
    return docs.map(doc => RefreshTokenMapper.toDomain(doc) as RefreshToken);
  }

  async create(refreshToken: RefreshToken): Promise<RefreshToken> {
    const persistenceData = RefreshTokenMapper.toPersistence(refreshToken);
    const doc = await RefreshTokenModel.create(persistenceData);
    return RefreshTokenMapper.toDomain(doc) as RefreshToken;
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await RefreshTokenModel.findOneAndDelete({ token });
    return !!result;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await RefreshTokenModel.deleteMany({ userId });
    return result.deletedCount;
  }
}

export default MongoRefreshTokenRepository;
