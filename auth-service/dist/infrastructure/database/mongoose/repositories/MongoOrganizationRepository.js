import { IOrganizationRepository } from '../../../../domain/repositories/IOrganizationRepository.js';
import { OrganizationMapper } from '../../../mappers/OrganizationMapper.js';
import { OrganizationModel } from '../schemas/OrganizationSchema.js';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Malformed ObjectId makes Mongoose throw CastError; treat it as "not found"
const isCastError = (error) => error?.name === 'CastError';
/**
 * MongoDB implementation of Organization Repository
 */
export class MongoOrganizationRepository extends IOrganizationRepository {
    async findById(id) {
        try {
            const doc = await OrganizationModel.findById(id);
            return OrganizationMapper.toDomain(doc);
        }
        catch (error) {
            if (isCastError(error))
                return null;
            throw error;
        }
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
        const doc = await OrganizationModel.findByIdAndUpdate(id, { $set: updates }, { new: true });
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
    async findAll({ search, page, limit }) {
        const query = {};
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
            items: docs.map(doc => OrganizationMapper.toDomain(doc)),
            total
        };
    }
    async updateServices(id, services) {
        try {
            const doc = await OrganizationModel.findByIdAndUpdate(id, { $set: { services } }, { new: true, runValidators: true });
            return OrganizationMapper.toDomain(doc);
        }
        catch (error) {
            if (isCastError(error))
                return null;
            throw error;
        }
    }
}
export default MongoOrganizationRepository;
