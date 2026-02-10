import { IUserRepository } from '../../../../domain/repositories/IUserRepository.js';
import { UserMapper } from '../../../mappers/UserMapper.js';
import { UserModel } from '../schemas/UserSchema.js';

/**
 * MongoDB implementation of User Repository
 */
export class MongoUserRepository extends IUserRepository {
  async findById(id) {
    const doc = await UserModel.findById(id);
    return UserMapper.toDomain(doc);
  }

  async findByEmail(email) {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return UserMapper.toDomain(doc);
  }

  async findByOrganizationId(organizationId, options = {}) {
    const query = { organizationId };

    if (options.excludeRoles && options.excludeRoles.length > 0) {
      query.role = { $nin: options.excludeRoles };
    }

    const projection = options.excludeFields
      ? options.excludeFields.reduce((acc, field) => ({ ...acc, [field]: 0 }), {})
      : {};

    const docs = await UserModel.find(query, projection);
    return docs.map(doc => UserMapper.toDomain(doc));
  }

  async create(user) {
    const persistenceData = UserMapper.toPersistence(user);
    const doc = await UserModel.create(persistenceData);
    return UserMapper.toDomain(doc);
  }

  async update(id, updates) {
    const doc = await UserModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    return UserMapper.toDomain(doc);
  }

  async delete(id) {
    const result = await UserModel.findByIdAndDelete(id);
    return !!result;
  }

  async existsByEmail(email) {
    const count = await UserModel.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }
}

export default MongoUserRepository;
