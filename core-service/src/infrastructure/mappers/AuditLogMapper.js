import { AuditLog } from '../../domain/entities/AuditLog.js';

/**
 * Maps between AuditLog domain entity and Sequelize model
 */
export class AuditLogMapper {
  /**
   * Convert Sequelize model instance to domain entity
   * @param {Object} model - Sequelize model instance
   * @returns {AuditLog|null}
   */
  static toDomain(model) {
    if (!model) return null;

    const data = model.dataValues || model;

    return new AuditLog({
      id: data.id,
      organizationId: data.organizationId,
      userId: data.userId,
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
   * @param {AuditLog} entity - Domain entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    return {
      organizationId: entity.organizationId,
      userId: entity.userId,
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
   * @param {AuditLog} entity - Domain entity
   * @returns {Object}
   */
  static toResponse(entity) {
    if (!entity) return null;

    return {
      id: entity.id,
      organizationId: entity.organizationId,
      userId: entity.userId,
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
