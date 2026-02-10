/**
 * Change Password Request DTO
 */
export class ChangePasswordRequestDto {
  constructor({
    userId,
    currentPassword,
    newPassword
  }) {
    this.userId = userId;
    this.currentPassword = currentPassword;
    this.newPassword = newPassword;
  }

  static fromRequest(body, userId) {
    return new ChangePasswordRequestDto({
      userId: userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });
  }
}

export default ChangePasswordRequestDto;
