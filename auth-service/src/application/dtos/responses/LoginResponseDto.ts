import type { User } from '../../../domain/entities/User.js';

export interface LoginUserSummary {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  organizationName?: string;
  role: string;
}

export interface LoginResponseDtoParams {
  user: LoginUserSummary;
  accessToken: string;
  refreshToken: string;
}

/**
 * Login Response DTO
 */
export class LoginResponseDto {
  user: LoginUserSummary;
  accessToken: string;
  refreshToken: string;

  constructor({
    user,
    accessToken,
    refreshToken
  }: LoginResponseDtoParams) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  static create(user: User, accessToken: string, refreshToken: string, organizationName?: string): LoginResponseDto {
    return new LoginResponseDto({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        organizationName,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  }

  toJSON(): LoginResponseDtoParams {
    return {
      user: this.user,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    };
  }
}

export default LoginResponseDto;
