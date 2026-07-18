export interface PasswordResetTokenProps {
  id?: string;
  userId: string;
  token: string;
  createdAt?: Date;
}

/**
 * PasswordResetToken domain entity
 * Pure domain object without database dependencies
 */
export class PasswordResetToken {
  id?: string;
  userId: string;
  token: string;
  createdAt: Date;

  constructor({
    id,
    userId,
    token,
    createdAt = new Date()
  }: PasswordResetTokenProps) {
    this.id = id;
    this.userId = userId;
    this.token = token;
    this.createdAt = createdAt;
  }

  /**
   * Check if token has expired
   * @param expiresInSeconds - Token expiration time in seconds (default 1 hour)
   */
  isExpired(expiresInSeconds = 3600): boolean {
    const expirationDate = new Date(this.createdAt.getTime() + expiresInSeconds * 1000);
    return new Date() > expirationDate;
  }
}

export default PasswordResetToken;
