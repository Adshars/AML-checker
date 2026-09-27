import { normalizeOrganizationServices } from '../../../domain/entities/OrganizationServices.js';
/**
 * Register Organization Request DTO
 */
export class RegisterOrgRequestDto {
    orgName;
    country;
    city;
    address;
    email;
    password;
    firstName;
    lastName;
    services;
    constructor({ orgName, country, city, address, email, password, firstName, lastName, services }) {
        this.orgName = orgName?.trim();
        this.country = country?.trim();
        this.city = city?.trim();
        this.address = address?.trim();
        this.email = email?.toLowerCase()?.trim();
        this.password = password;
        this.firstName = firstName?.trim();
        this.lastName = lastName?.trim();
        this.services = normalizeOrganizationServices(services);
    }
    static fromRequest(body) {
        return new RegisterOrgRequestDto({
            orgName: body.orgName,
            country: body.country,
            city: body.city,
            address: body.address,
            email: body.email,
            password: body.password,
            firstName: body.firstName,
            lastName: body.lastName,
            services: body.services
        });
    }
}
export default RegisterOrgRequestDto;
