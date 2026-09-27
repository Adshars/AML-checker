/**
 * Organization Summary DTO
 * Used by SuperAdmin list and details views (no API credentials)
 */
export class OrganizationSummaryDto {
    id;
    name;
    country;
    city;
    address;
    createdAt;
    services;
    userCount;
    constructor(organization, userCount) {
        this.id = organization.id;
        this.name = organization.name;
        this.country = organization.country;
        this.city = organization.city;
        this.address = organization.address;
        this.createdAt = organization.createdAt;
        this.services = organization.services;
        this.userCount = userCount;
    }
    static fromEntity(organization, userCount = 0) {
        return new OrganizationSummaryDto(organization, userCount);
    }
}
export default OrganizationSummaryDto;
