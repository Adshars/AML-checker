export interface LoginRequestDtoParams {
  email?: string;
  password?: string;
}

/**
 * Login Request DTO
 */
export class LoginRequestDto {
  email?: string;
  password?: string;

  constructor({ email, password }: LoginRequestDtoParams) {
    this.email = email?.toLowerCase()?.trim();
    this.password = password;
  }

  static fromRequest(body: LoginRequestDtoParams): LoginRequestDto {
    return new LoginRequestDto({
      email: body.email,
      password: body.password
    });
  }
}

export default LoginRequestDto;
