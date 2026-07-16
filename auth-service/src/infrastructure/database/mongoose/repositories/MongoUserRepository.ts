import { IUserRepository, type FindByOrganizationOptions } from '../../../../domain/repositories/IUserRepository.js';
import { UserMapper } from '../../../mappers/UserMapper.js';
import { UserModel } from '../schemas/UserSchema.js';
import type { User, UserProps } from '../../../../domain/entities/User.js';

/**
 * MongoDB implementation of User Repository
 */
export class MongoUserRepository extends IUserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    return UserMapper.toDomain(doc);
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return UserMapper.toDomain(doc);
  }

  async findByOrganizationId(organizationId: string, options: FindByOrganizationOptions = {}): Promise<User[]> {
    const query: Record<string, unknown> = { organizationId };

    if (options.excludeRoles && options.excludeRoles.length > 0) {
      query.role = { $nin: options.excludeRoles };
    }

    const projection = options.excludeFields
      ? options.excludeFields.reduce((acc, field) => ({ ...acc, [field]: 0 }), {} as Record<string, number>)
      : {};

    const docs = await UserModel.find(query, projection);
    return docs.map(doc => UserMapper.toDomain(doc) as User);
  }

  async create(user: User): Promise<User> {
    const persistenceData = UserMapper.toPersistence(user);
    const doc = await UserModel.create(persistenceData);
    return UserMapper.toDomain(doc) as User;
  }

  async update(id: string, updates: Partial<UserProps>): Promise<User | null> {
    const doc = await UserModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    return UserMapper.toDomain(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return !!result;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }
}

export default MongoUserRepository;
