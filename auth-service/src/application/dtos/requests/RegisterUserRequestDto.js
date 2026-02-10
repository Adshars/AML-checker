/**
 * Register User Request DTO
 */
export class RegisterUserRequestDto {
  constructor({
    email,
    password,
    firstName,
    lastName,
    organizationId
  }) {
    this.email = email?.toLowerCase()?.trim();
    this.password = password;
    this.firstName = firstName?.trim();
    this.lastName = lastName?.trim();
    this.organizationId = organizationId;
  }

  static fromRequest(body, organizationId) {
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
