import { Page } from '@playwright/test';

export class LoginPage {
  private readonly emailInput = this.page.getByLabel('Email address');
  private readonly passwordInput = this.page.getByLabel('Password').first();
  private readonly signInButton = this.page.getByRole('button', { name: 'Sign In' });
  readonly errorAlert = this.page.getByRole('alert').filter({ hasText: /invalid|error|please fill/i });
  // Forgot password modal
  private readonly forgotPasswordLink = this.page.getByRole('button', { name: 'Forgot Password?' });
  private readonly resetModal = this.page.getByRole('dialog');
  private readonly resetEmailInput = this.resetModal.getByLabel('Email');
  private readonly sendResetButton = this.resetModal.getByRole('button', { name: 'Send Reset Link' });
  // Bootstrap success alert: variant="success" renders as .alert-success
  readonly resetSuccessAlert = this.resetModal.locator('.alert-success');

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectDashboard(): Promise<void> {
    await this.page.waitForURL('**/dashboard', { timeout: 10_000 });
  }

  async expectSuperAdminPanel(): Promise<void> {
    await this.page.waitForURL('**/superadmin', { timeout: 10_000 });
  }

  async openForgotPasswordModal(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.resetModal.waitFor({ state: 'visible' });
  }

  async submitPasswordReset(email: string): Promise<void> {
    await this.resetEmailInput.fill(email);
    await this.sendResetButton.click();
  }
}
