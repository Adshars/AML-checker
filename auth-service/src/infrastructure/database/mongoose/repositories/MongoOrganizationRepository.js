import { IOrganizationRepository } from '../../../../domain/repositories/IOrganizationRepository.js';
import { OrganizationMapper } from '../../../mappers/OrganizationMapper.js';
import { OrganizationModel } from '../schemas/OrganizationSchema.js';

/**
 * MongoDB implementation of Organization Repository
 */
export class MongoOrganizationRepository extends IOrganizationRepository {
  async findById(id) {
    const doc = await OrganizationModel.findById(id);
    return OrganizationMapper.toDomain(doc);
  }

  async findByName(name) {
    const doc = await OrganizationModel.findOne({ name });
    return OrganizationMapper.toDomain(doc);
  }

  async findByApiKey(apiKey) {
    const doc = await OrganizationModel.findOne({ apiKey });
    return OrganizationMapper.toDomain(doc);
  }

  async create(organization) {
    const persistenceData = OrganizationMapper.toPersistence(organization);
    const doc = await OrganizationModel.create(persistenceData);
    return OrganizationMapper.toDomain(doc);
  }

  async update(id, updates) {
    const doc = await OrganizationModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    return OrganizationMapper.toDomain(doc);
  }

  async delete(id) {
    const result = await OrganizationModel.findByIdAndDelete(id);
    return !!result;
  }

  async existsByName(name) {
    const count = await OrganizationModel.countDocuments({ name });
    return count > 0;
  }
}

export default MongoOrganizationRepository;
