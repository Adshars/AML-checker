import { IOrganizationRepository } from '../../../../domain/repositories/IOrganizationRepository.js';
import { OrganizationMapper } from '../../../mappers/OrganizationMapper.js';
import { OrganizationModel } from '../schemas/OrganizationSchema.js';
import type { Organization, OrganizationProps } from '../../../../domain/entities/Organization.js';

/**
 * MongoDB implementation of Organization Repository
 */
export class MongoOrganizationRepository extends IOrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findById(id);
    return OrganizationMapper.toDomain(doc);
  }

  async findByName(name: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ name });
    return OrganizationMapper.toDomain(doc);
  }

  async findByApiKey(apiKey: string): Promise<Organization | null> {
    const doc = await OrganizationModel.findOne({ apiKey });
    return OrganizationMapper.toDomain(doc);
  }

  async create(organization: Organization): Promise<Organization> {
    const persistenceData = OrganizationMapper.toPersistence(organization);
    const doc = await OrganizationModel.create(persistenceData);
    return OrganizationMapper.toDomain(doc) as Organization;
  }

  async update(id: string, updates: Partial<OrganizationProps>): Promise<Organization | null> {
    const doc = await OrganizationModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    return OrganizationMapper.toDomain(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await OrganizationModel.findByIdAndDelete(id);
    return !!result;
  }

  async existsByName(name: string): Promise<boolean> {
    const count = await OrganizationModel.countDocuments({ name });
    return count > 0;
  }
}

export default MongoOrganizationRepository;
