import {
  IOrganizationRepository,
  type FindAllOrganizationsParams,
  type FindAllOrganizationsResult
} from '../../../../domain/repositories/IOrganizationRepository.js';
import { OrganizationMapper } from '../../../mappers/OrganizationMapper.js';
import { OrganizationModel } from '../schemas/OrganizationSchema.js';
import type { Organization, OrganizationProps } from '../../../../domain/entities/Organization.js';
import type { OrganizationServices } from '../../../../domain/entities/OrganizationServices.js';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Malformed ObjectId makes Mongoose throw CastError; treat it as "not found"
const isCastError = (error: unknown): boolean =>
  (error as { name?: string } | null)?.name === 'CastError';

/**
 * MongoDB implementation of Organization Repository
 */
export class MongoOrganizationRepository extends IOrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    try {
      const doc = await OrganizationModel.findById(id);
      return OrganizationMapper.toDomain(doc);
    } catch (error) {
      if (isCastError(error)) return null;
      throw error;
    }
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

  async findAll({ search, page, limit }: FindAllOrganizationsParams): Promise<FindAllOrganizationsResult> {
    const query: Record<string, unknown> = {};
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }

    const [docs, total] = await Promise.all([
      OrganizationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      OrganizationModel.countDocuments(query)
    ]);

    return {
      items: docs.map(doc => OrganizationMapper.toDomain(doc) as Organization),
      total
    };
  }

  async updateServices(id: string, services: OrganizationServices): Promise<Organization | null> {
    try {
      const doc = await OrganizationModel.findByIdAndUpdate(
        id,
        { $set: { services } },
        { new: true, runValidators: true }
      );
      return OrganizationMapper.toDomain(doc);
    } catch (error) {
      if (isCastError(error)) return null;
      throw error;
    }
  }
}

export default MongoOrganizationRepository;
