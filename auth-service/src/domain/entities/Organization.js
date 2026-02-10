/**
 * Organization domain entity
 * Pure domain object without database dependencies
 */
export class Organization {
  constructor({
    id,
    name,
    country,
    city,
    address,
    apiKey = null,
    apiSecretHash = null,
    createdAt = new Date()
  }) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.city = city;
    this.address = address;
    this.apiKey = apiKey;
    this.apiSecretHash = apiSecretHash;
    this.createdAt = createdAt;
  }

  hasApiCredentials() {
    return !!(this.apiKey && this.apiSecretHash);
  }

  getFullAddress() {
    return `${this.address}, ${this.city}, ${this.country}`;
  }
}

export default Organization;
