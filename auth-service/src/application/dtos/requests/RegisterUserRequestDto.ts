export interface RegisterUserBody {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterUserRequestDtoParams extends RegisterUserBody {
  organizationId?: string;
}

/**
 * Register User Request DTO
 */
export class RegisterUserRequestDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;

  constructor({
    email,
    password,
    firstName,
    lastName,
    organizationId
  }: RegisterUserRequestDtoParams) {
    this.email = email?.toLowerCase()?.trim();
    this.password = password;
    this.firstName = firstName?.trim();
    this.lastName = lastName?.trim();
    this.organizationId = organizationId;
  }

  static fromRequest(body: RegisterUserBody, organizationId?: string): RegisterUserRequestDto {
    return new RegisterUserRequestDto({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      organizationId: organizationId
    });
  }
}

export default RegisterUserRequestDto;
