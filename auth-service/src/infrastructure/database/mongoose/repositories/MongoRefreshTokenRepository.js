import { IRefreshTokenRepository } from '../../../../domain/repositories/IRefreshTokenRepository.js';
import { RefreshTokenMapper } from '../../../mappers/RefreshTokenMapper.js';
import { RefreshTokenModel } from '../schemas/RefreshTokenSchema.js';

/**
 * MongoDB implementation of RefreshToken Repository
 */
export class MongoRefreshTokenRepository extends IRefreshTokenRepository {
  async findByToken(token) {
    const doc = await RefreshTokenModel.findOne({ token });
    return RefreshTokenMapper.toDomain(doc);
  }

  async findByUserId(userId) {
    const docs = await RefreshTokenModel.find({ userId });
    return docs.map(doc => RefreshTokenMapper.toDomain(doc));
  }

  async create(refreshToken) {
    const persistenceData = RefreshTokenMapper.toPersistence(refreshToken);
    const doc = await RefreshTokenModel.create(persistenceData);
    return RefreshTokenMapper.toDomain(doc);
  }

  async deleteByToken(token) {
    const result = await RefreshTokenModel.findOneAndDelete({ token });
    return !!result;
  }

  async deleteByUserId(userId) {
    const result = await RefreshTokenModel.deleteMany({ userId });
    return result.deletedCount;
  }
}

export default MongoRefreshTokenRepository;
