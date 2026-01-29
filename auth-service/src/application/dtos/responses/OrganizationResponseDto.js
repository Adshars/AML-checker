/**
 * Organization Response DTO
 */
export class OrganizationResponseDto {
  constructor({
    id,
    name,
    country,
    city,
    address,
    apiKey,
    apiSecret,
    createdAt
  }) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.city = city;
    this.address = address;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.createdAt = createdAt;
  }

  static fromEntity(organization, includeSecret = false, plainSecret = null) {
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

  toJSON() {
    const json = {
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
