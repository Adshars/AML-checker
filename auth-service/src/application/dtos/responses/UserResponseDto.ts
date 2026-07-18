import type { User } from '../../../domain/entities/User.js';

export interface UserResponseDtoParams {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role: string;
  createdAt: Date;
}

/**
 * User Response DTO
 */
export class UserResponseDto {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role: string;
  createdAt: Date;

  constructor({
    id,
    email,
    firstName,
    lastName,
    organizationId,
    role,
    createdAt
  }: UserResponseDtoParams) {
    this.id = id;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.organizationId = organizationId;
    this.role = role;
    this.createdAt = createdAt;
  }

  static fromEntity(user: User): UserResponseDto | null {
    if (!user) return null;

    return new UserResponseDto({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      role: user.role,
      createdAt: user.createdAt
    });
  }

  static fromEntities(users: User[]): (UserResponseDto | null)[] {
    return users.map(user => UserResponseDto.fromEntity(user));
  }

  toJSON(): Omit<UserResponseDtoParams, never> {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      organizationId: this.organizationId,
      role: this.role,
      createdAt: this.createdAt
    };
  }
}

export default UserResponseDto;
