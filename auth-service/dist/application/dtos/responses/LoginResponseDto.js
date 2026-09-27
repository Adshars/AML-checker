import { normalizeOrganizationServices } from '../../../domain/entities/OrganizationServices.js';
/**
 * Login Response DTO
 */
export class LoginResponseDto {
    user;
    accessToken;
    refreshToken;
    constructor({ user, accessToken, refreshToken }) {
        this.user = user;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
    static create(user, accessToken, refreshToken, organizationName, services) {
        return new LoginResponseDto({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                organizationId: user.organizationId,
                organizationName,
                role: user.role,
                services: normalizeOrganizationServices(services)
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
