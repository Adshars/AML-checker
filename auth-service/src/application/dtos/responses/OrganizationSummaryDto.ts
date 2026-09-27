import type { Organization } from '../../../domain/entities/Organization.js';
import type { OrganizationServices } from '../../../domain/entities/OrganizationServices.js';

/**
 * Organization Summary DTO
 * Used by SuperAdmin list and details views (no API credentials)
 */
export class OrganizationSummaryDto {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  createdAt: Date;
  services: OrganizationServices;
  userCount: number;

  constructor(organization: Organization, userCount: number) {
    this.id = organization.id;
    this.name = organization.name;
    this.country = organization.country;
    this.city = organization.city;
    this.address = organization.address;
    this.createdAt = organization.createdAt;
    this.services = organization.services;
    this.userCount = userCount;
  }

  static fromEntity(organization: Organization, userCount = 0): OrganizationSummaryDto {
    return new OrganizationSummaryDto(organization, userCount);
  }
}

export default OrganizationSummaryDto;
