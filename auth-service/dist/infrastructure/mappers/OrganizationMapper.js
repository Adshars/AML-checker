import { Organization } from '../../domain/entities/Organization.js';
import { normalizeOrganizationServices } from '../../domain/entities/OrganizationServices.js';
/**
 * Maps between Organization domain entity and MongoDB document
 */
export class OrganizationMapper {
    /**
     * Convert MongoDB document to domain entity
     */
    static toDomain(doc) {
        if (!doc)
            return null;
        return new Organization({
            id: doc._id.toString(),
            name: doc.name,
            country: doc.country,
            city: doc.city,
            address: doc.address,
            apiKey: doc.apiKey,
            apiSecretHash: doc.apiSecretHash,
            // Legacy documents may lack the field entirely
            services: normalizeOrganizationServices(doc.services),
            createdAt: doc.createdAt
        });
    }
    /**
     * Convert domain entity to persistence format
     */
    static toPersistence(entity) {
        const doc = {
            name: entity.name,
            country: entity.country,
            city: entity.city,
            address: entity.address,
            services: normalizeOrganizationServices(entity.services)
        };
        if (entity.apiKey) {
            doc.apiKey = entity.apiKey;
        }
        if (entity.apiSecretHash) {
            doc.apiSecretHash = entity.apiSecretHash;
        }
        if (entity.createdAt) {
            doc.createdAt = entity.createdAt;
        }
        return doc;
    }
    /**
     * Convert domain entity to response format (without sensitive data)
     */
    static toResponse(entity) {
        if (!entity)
            return null;
        return {
            id: entity.id,
            name: entity.name,
            country: entity.country,
            city: entity.city,
            address: entity.address,
            apiKey: entity.apiKey,
            services: entity.services,
            createdAt: entity.createdAt
        };
    }
}
export default OrganizationMapper;
