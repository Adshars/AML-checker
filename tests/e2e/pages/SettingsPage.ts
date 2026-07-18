import { Page, Locator } from '@playwright/test';

export class SettingsPage {
  private readonly currentPasswordInput: Locator;
  // exact: true prevents substring match on "Confirm New Password"
  private readonly newPasswordInput: Locator;
  private readonly confirmNewPasswordInput: Locator;
  private readonly submitBtn: Locator;
  readonly successAlert: Locator;
  readonly errorAlert: Locator;

  constructor(private readonly page: Page) {
    this.currentPasswordInput = this.page.getByLabel('Current Password');
    this.newPasswordInput = this.page.getByLabel('New Password', { exact: true });
    this.confirmNewPasswordInput = this.page.getByLabel('Confirm New Password');
    this.submitBtn = this.page.getByRole('button', { name: 'Update Password' });
    this.successAlert = this.page.getByTestId('settings-success-alert');
    this.errorAlert = this.page.getByTestId('settings-error-alert');
  }

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
