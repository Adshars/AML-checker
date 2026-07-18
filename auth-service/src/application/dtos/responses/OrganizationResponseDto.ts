import type { Organization } from '../../../domain/entities/Organization.js';

export interface OrganizationResponseDtoParams {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  createdAt?: Date;
}

/**
 * Organization Response DTO
 */
export class OrganizationResponseDto {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  createdAt?: Date;

  constructor({
    id,
    name,
    country,
    city,
    address,
    apiKey,
    apiSecret,
    createdAt
  }: OrganizationResponseDtoParams) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.city = city;
    this.address = address;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.createdAt = createdAt;
  }

  static fromEntity(organization: Organization, includeSecret = false, plainSecret: string | null = null): OrganizationResponseDto {
    return new OrganizationResponseDto({
      id: organization.id,
      name: organization.name,
      country: organization.country,
      city: organization.city,
      address: organization.address,
      apiKey: organization.apiKey,
      apiSecret: includeSecret ? plainSecret : undefined,
      createdAt: organization.createdAt
    });
  }

  toJSON(): Omit<OrganizationResponseDtoParams, 'apiSecret'> & { apiSecret?: string | null } {
    const json: Omit<OrganizationResponseDtoParams, 'apiSecret'> & { apiSecret?: string | null } = {
      id: this.id,
      name: this.name,
      country: this.country,
      city: this.city,
      address: this.address,
      apiKey: this.apiKey,
      createdAt: this.createdAt
    };

    if (this.apiSecret) {
      json.apiSecret = this.apiSecret;
    }

    return json;
  }
}

export default OrganizationResponseDto;
