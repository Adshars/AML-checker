import { normalizeOrganizationServices } from './OrganizationServices.js';
/**
 * Organization domain entity
 * Pure domain object without database dependencies
 */
export class Organization {
    id;
    name;
    country;
    city;
    address;
    apiKey;
    apiSecretHash;
    services;
    createdAt;
    constructor({ id, name, country, city, address, apiKey = null, apiSecretHash = null, services, createdAt = new Date() }) {
        this.id = id;
        this.name = name;
        this.country = country;
        this.city = city;
        this.address = address;
        this.apiKey = apiKey;
        this.apiSecretHash = apiSecretHash;
        this.services = normalizeOrganizationServices(services);
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
