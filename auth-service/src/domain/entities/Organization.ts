export interface OrganizationProps {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey?: string | null;
  apiSecretHash?: string | null;
  createdAt?: Date;
}

/**
 * Organization domain entity
 * Pure domain object without database dependencies
 */
export class Organization {
  id?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  apiKey: string | null;
  apiSecretHash: string | null;
  createdAt: Date;

  constructor({
    id,
    name,
    country,
    city,
    address,
    apiKey = null,
    apiSecretHash = null,
    createdAt = new Date()
  }: OrganizationProps) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.city = city;
    this.address = address;
    this.apiKey = apiKey;
    this.apiSecretHash = apiSecretHash;
    this.createdAt = createdAt;
  }

  hasApiCredentials(): boolean {
    return !!(this.apiKey && this.apiSecretHash);
  }

  getFullAddress(): string {
    return `${this.address}, ${this.city}, ${this.country}`;
  }
}

export default Organization;
