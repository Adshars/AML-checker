import { Page } from '@playwright/test';

export class SettingsPage {
  private readonly currentPasswordInput = this.page.getByLabel('Current Password');
  // exact: true prevents substring match on "Confirm New Password"
  private readonly newPasswordInput = this.page.getByLabel('New Password', { exact: true });
  private readonly confirmNewPasswordInput = this.page.getByLabel('Confirm New Password');
  private readonly submitBtn = this.page.getByRole('button', { name: 'Update Password' });
  readonly successAlert = this.page.getByTestId('settings-success-alert');
  readonly errorAlert = this.page.getByTestId('settings-error-alert');

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/settings');
    await this.submitBtn.waitFor({ state: 'visible' });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmNewPassword = newPassword,
  ): Promise<void> {
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmNewPasswordInput.fill(confirmNewPassword);
    await this.submitBtn.click();
  }
}
