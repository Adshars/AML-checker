import { Organization } from '../../domain/entities/Organization.js';
import type { OrganizationDocument } from '../database/mongoose/schemas/OrganizationSchema.js';

export interface OrganizationPersistence {
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey?: string;
  apiSecretHash?: string;
  createdAt?: Date;
}

/**
 * Maps between Organization domain entity and MongoDB document
 */
export class OrganizationMapper {
  /**
   * Convert MongoDB document to domain entity
   */
  static toDomain(doc: OrganizationDocument | null | undefined): Organization | null {
    if (!doc) return null;

    return new Organization({
      id: doc._id.toString(),
      name: doc.name,
      country: doc.country,
      city: doc.city,
      address: doc.address,
      apiKey: doc.apiKey,
      apiSecretHash: doc.apiSecretHash,
      createdAt: doc.createdAt
    });
  }

  /**
   * Convert domain entity to persistence format
   */
  static toPersistence(entity: Organization): OrganizationPersistence {
    const doc: OrganizationPersistence = {
      name: entity.name,
      country: entity.country,
      city: entity.city,
      address: entity.address
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
  static toResponse(entity: Organization | null | undefined): Record<string, unknown> | null {
    if (!entity) return null;

    return {
      id: entity.id,
      name: entity.name,
      country: entity.country,
      city: entity.city,
      address: entity.address,
      apiKey: entity.apiKey,
      createdAt: entity.createdAt
    };
  }
}

export default OrganizationMapper;
