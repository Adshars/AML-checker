/**
 * Login Response DTO
 */
export class LoginResponseDto {
  constructor({
    user,
    accessToken,
    refreshToken
  }) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  static create(user, accessToken, refreshToken) {
    return new LoginResponseDto({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  }

  toJSON() {
    return {
      user: this.user,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    };
  }
}

export default LoginResponseDto;
