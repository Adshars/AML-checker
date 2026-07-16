export type UserRole = 'superadmin' | 'admin' | 'user';

export interface UserProps {
  id?: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role?: UserRole;
  createdAt?: Date;
}

/**
 * User domain entity
 * Pure domain object without database dependencies
 */
export class User {
  id?: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  role: UserRole;
  createdAt: Date;

  static ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    USER: 'user'
  } as const;

  constructor({
    id,
    email,
    passwordHash,
    firstName,
    lastName,
    organizationId,
    role = 'user',
    createdAt = new Date()
  }: UserProps) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.firstName = firstName;
    this.lastName = lastName;
    this.organizationId = organizationId;
    this.role = role;
    this.createdAt = createdAt;
  }

  isSuperAdmin(): boolean {
    return this.role === User.ROLES.SUPERADMIN;
  }

  isAdmin(): boolean {
    return this.role === User.ROLES.ADMIN || this.role === User.ROLES.SUPERADMIN;
  }

  belongsToOrganization(organizationId?: string): boolean {
    return this.organizationId?.toString() === organizationId?.toString();
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export default User;
