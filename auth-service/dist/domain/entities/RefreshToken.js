/**
 * RefreshToken domain entity
 * Pure domain object without database dependencies
 */
export class RefreshToken {
    id;
    token;
    userId;
    createdAt;
    constructor({ id, token, userId, createdAt = new Date() }) {
        this.id = id;
        this.token = token;
        this.userId = userId;
        this.createdAt = createdAt;
    }
    /**
     * Check if token has expired
     * @param expiresInSeconds - Token expiration time in seconds (default 7 days)
     */
    isExpired(expiresInSeconds = 604800) {
        const expirationDate = new Date(this.createdAt.getTime() + expiresInSeconds * 1000);
        return new Date() > expirationDate;
    }
}
export default RefreshToken;
