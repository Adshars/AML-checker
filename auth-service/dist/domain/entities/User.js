/**
 * User domain entity
 * Pure domain object without database dependencies
 */
export class User {
    id;
    email;
    passwordHash;
    firstName;
    lastName;
    organizationId;
    role;
    createdAt;
    static ROLES = {
        SUPERADMIN: 'superadmin',
        ADMIN: 'admin',
        USER: 'user'
    };
    constructor({ id, email, passwordHash, firstName, lastName, organizationId, role = 'user', createdAt = new Date() }) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.firstName = firstName;
        this.lastName = lastName;
        this.organizationId = organizationId;
        this.role = role;
        this.createdAt = createdAt;
    }
    isSuperAdmin() {
        return this.role === User.ROLES.SUPERADMIN;
    }
    isAdmin() {
        return this.role === User.ROLES.ADMIN || this.role === User.ROLES.SUPERADMIN;
    }
    belongsToOrganization(organizationId) {
        return this.organizationId?.toString() === organizationId?.toString();
    }
    getFullName() {
        return `${this.firstName} ${this.lastName}`;
    }
}
export default User;
