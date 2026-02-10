import { IPasswordResetTokenRepository } from '../../../../domain/repositories/IPasswordResetTokenRepository.js';
import { PasswordResetTokenMapper } from '../../../mappers/PasswordResetTokenMapper.js';
import { PasswordResetTokenModel } from '../schemas/PasswordResetTokenSchema.js';

/**
 * MongoDB implementation of PasswordResetToken Repository
 */
export class MongoPasswordResetTokenRepository extends IPasswordResetTokenRepository {
  async findByUserId(userId) {
    const doc = await PasswordResetTokenModel.findOne({ userId });
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async findByToken(token) {
    const doc = await PasswordResetTokenModel.findOne({ token });
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async create(passwordResetToken) {
    const persistenceData = PasswordResetTokenMapper.toPersistence(passwordResetToken);
    const doc = await PasswordResetTokenModel.create(persistenceData);
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async deleteByUserId(userId) {
    const result = await PasswordResetTokenModel.findOneAndDelete({ userId });
    return !!result;
  }

  async deleteByToken(token) {
    const result = await PasswordResetTokenModel.findOneAndDelete({ token });
    return !!result;
  }
}

export default MongoPasswordResetTokenRepository;
