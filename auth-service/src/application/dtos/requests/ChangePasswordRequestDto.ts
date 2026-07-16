export interface ChangePasswordRequestDtoParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordRequestBody {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Change Password Request DTO
 */
export class ChangePasswordRequestDto {
  userId: string;
  currentPassword: string;
  newPassword: string;

  constructor({
    userId,
    currentPassword,
    newPassword
  }: ChangePasswordRequestDtoParams) {
    this.userId = userId;
    this.currentPassword = currentPassword;
    this.newPassword = newPassword;
  }

  static fromRequest(body: ChangePasswordRequestBody, userId: string): ChangePasswordRequestDto {
    return new ChangePasswordRequestDto({
      userId: userId,
      currentPassword: body.currentPassword as string,
      newPassword: body.newPassword as string
    });
  }
}

export default ChangePasswordRequestDto;
