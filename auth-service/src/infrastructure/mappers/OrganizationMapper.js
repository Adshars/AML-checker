import { Organization } from '../../domain/entities/Organization.js';

/**
 * Maps between Organization domain entity and MongoDB document
 */
export class OrganizationMapper {
  /**
   * Convert MongoDB document to domain entity
   * @param {Object} doc - MongoDB document
   * @returns {Organization|null}
   */
  static toDomain(doc) {
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
   * @param {Organization} entity - Domain entity
   * @returns {Object}
   */
  static toPersistence(entity) {
    const doc = {
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
   * @param {Organization} entity - Domain entity
   * @returns {Object}
   */
  static toResponse(entity) {
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
