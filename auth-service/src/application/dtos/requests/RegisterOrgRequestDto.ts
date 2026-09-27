import { normalizeOrganizationServices, type OrganizationServices } from '../../../domain/entities/OrganizationServices.js';

export interface RegisterOrgRequestDtoParams {
  orgName?: string;
  country?: string;
  city?: string;
  address?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  services?: Partial<OrganizationServices> | null;
}

/**
 * Register Organization Request DTO
 */
export class RegisterOrgRequestDto {
  orgName?: string;
  country?: string;
  city?: string;
  address?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  services: OrganizationServices;

  constructor({
    orgName,
    country,
    city,
    address,
    email,
    password,
    firstName,
    lastName,
    services
  }: RegisterOrgRequestDtoParams) {
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

  static fromRequest(body: RegisterOrgRequestDtoParams): RegisterOrgRequestDto {
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
