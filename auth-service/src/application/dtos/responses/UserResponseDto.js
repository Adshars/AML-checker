/**
 * User Response DTO
 */
export class UserResponseDto {
  constructor({
    id,
    email,
    firstName,
    lastName,
    organizationId,
    role,
    createdAt
  }) {
    this.id = id;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.organizationId = organizationId;
    this.role = role;
    this.createdAt = createdAt;
  }

  static fromEntity(user) {
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

  static fromEntities(users) {
    return users.map(user => UserResponseDto.fromEntity(user));
  }

  toJSON() {
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
