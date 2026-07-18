import { AuditLog } from '../../domain/entities/AuditLog.js';
/**
 * Maps between AuditLog domain entity and Sequelize model
 */
export class AuditLogMapper {
    /**
     * Convert Sequelize model instance to domain entity
     */
    static toDomain(model) {
        if (!model)
            return null;
        const record = model;
        const data = record.dataValues || record;
        return new AuditLog({
            id: data.id,
            organizationId: data.organizationId,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
            searchQuery: data.searchQuery,
            hasHit: data.hasHit,
            hitsCount: data.hitsCount,
            entityName: data.entityName,
            entityScore: data.entityScore,
            entityBirthDate: data.entityBirthDate,
            entityGender: data.entityGender,
            entityCountries: data.entityCountries,
            entityDatasets: data.entityDatasets,
            entityDescription: data.entityDescription,
            hitDetails: data.hitDetails,
            isSanctioned: data.isSanctioned,
            isPep: data.isPep,
            createdAt: data.createdAt
        });
    }
    /**
     * Convert domain entity to persistence format
     */
    static toPersistence(entity) {
        return {
            organizationId: entity.organizationId,
            userId: entity.userId,
            userName: entity.userName,
            userEmail: entity.userEmail,
            searchQuery: entity.searchQuery,
            hasHit: entity.hasHit,
            hitsCount: entity.hitsCount,
            entityName: entity.entityName,
            entityScore: entity.entityScore,
            entityBirthDate: entity.entityBirthDate,
            entityGender: entity.entityGender,
            entityCountries: entity.entityCountries,
            entityDatasets: entity.entityDatasets,
            entityDescription: entity.entityDescription,
            hitDetails: entity.hitDetails,
            isSanctioned: entity.isSanctioned,
            isPep: entity.isPep
        };
    }
    /**
     * Convert domain entity to response format
     */
    static toResponse(entity) {
        if (!entity)
            return null;
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            userId: entity.userId,
            userName: entity.userName,
            userEmail: entity.userEmail,
            searchQuery: entity.searchQuery,
            hasHit: entity.hasHit,
            hitsCount: entity.hitsCount,
            entityName: entity.entityName,
            entityScore: entity.entityScore,
            entityBirthDate: entity.entityBirthDate,
            entityGender: entity.entityGender,
            entityCountries: entity.entityCountries,
            entityDatasets: entity.entityDatasets,
            entityDescription: entity.entityDescription,
            hitDetails: entity.hitDetails,
            isSanctioned: entity.isSanctioned,
            isPep: entity.isPep,
            createdAt: entity.createdAt
        };
    }
}
export default AuditLogMapper;
