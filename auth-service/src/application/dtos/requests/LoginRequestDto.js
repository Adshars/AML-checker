/**
 * Login Request DTO
 */
export class LoginRequestDto {
  constructor({ email, password }) {
    this.email = email?.toLowerCase()?.trim();
    this.password = password;
  }

  static fromRequest(body) {
    return new LoginRequestDto({
      email: body.email,
      password: body.password
    });
  }
}

export default LoginRequestDto;
