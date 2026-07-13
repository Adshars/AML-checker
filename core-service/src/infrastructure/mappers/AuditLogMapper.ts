import { AuditLog } from '../../domain/entities/AuditLog.js';
import type { AuditLogCreationAttributes } from '../database/sequelize/models/AuditLogModel.js';

/**
 * Maps between AuditLog domain entity and Sequelize model
 */
export class AuditLogMapper {
  /**
   * Convert Sequelize model instance to domain entity
   */
  static toDomain(model: unknown): AuditLog | null {
    if (!model) return null;

    const record = model as { dataValues?: Record<string, unknown> } & Record<string, unknown>;
    const data = record.dataValues || record;

    return new AuditLog({
      id: data.id as string | undefined,
      organizationId: data.organizationId as string,
      userId: data.userId as string | null,
      userName: data.userName as string | null,
      userEmail: data.userEmail as string | null,
      searchQuery: data.searchQuery as string,
      hasHit: data.hasHit as boolean,
      hitsCount: data.hitsCount as number,
      entityName: data.entityName as string | null,
      entityScore: data.entityScore as number | null,
      entityBirthDate: data.entityBirthDate as string | null,
      entityGender: data.entityGender as string | null,
      entityCountries: data.entityCountries as string | null,
      entityDatasets: data.entityDatasets as string | null,
      entityDescription: data.entityDescription as string | null,
      hitDetails: data.hitDetails as Record<string, unknown> | null,
      isSanctioned: data.isSanctioned as boolean,
      isPep: data.isPep as boolean,
      createdAt: data.createdAt as Date
    });
  }

  /**
   * Convert domain entity to persistence format
   */
  static toPersistence(entity: AuditLog): AuditLogCreationAttributes {
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
  static toResponse(entity: AuditLog | null | undefined): Record<string, unknown> | null {
    if (!entity) return null;

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
