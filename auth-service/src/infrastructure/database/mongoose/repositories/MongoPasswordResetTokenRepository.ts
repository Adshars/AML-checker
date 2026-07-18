import { IPasswordResetTokenRepository } from '../../../../domain/repositories/IPasswordResetTokenRepository.js';
import { PasswordResetTokenMapper } from '../../../mappers/PasswordResetTokenMapper.js';
import { PasswordResetTokenModel } from '../schemas/PasswordResetTokenSchema.js';
import type { PasswordResetToken } from '../../../../domain/entities/PasswordResetToken.js';

/**
 * MongoDB implementation of PasswordResetToken Repository
 */
export class MongoPasswordResetTokenRepository extends IPasswordResetTokenRepository {
  async findByUserId(userId: string): Promise<PasswordResetToken | null> {
    const doc = await PasswordResetTokenModel.findOne({ userId });
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const doc = await PasswordResetTokenModel.findOne({ token });
    return PasswordResetTokenMapper.toDomain(doc);
  }

  async create(passwordResetToken: PasswordResetToken): Promise<PasswordResetToken> {
    const persistenceData = PasswordResetTokenMapper.toPersistence(passwordResetToken);
    const doc = await PasswordResetTokenModel.create(persistenceData);
    return PasswordResetTokenMapper.toDomain(doc) as PasswordResetToken;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await PasswordResetTokenModel.findOneAndDelete({ userId });
    return !!result;
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await PasswordResetTokenModel.findOneAndDelete({ token });
    return !!result;
  }
}

export default MongoPasswordResetTokenRepository;
