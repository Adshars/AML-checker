import { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  readonly errorAlert: Locator;
  // Forgot password modal
  private readonly forgotPasswordLink: Locator;
  private readonly resetModal: Locator;
  private readonly resetEmailInput: Locator;
  private readonly sendResetButton: Locator;
  // Bootstrap success alert: variant="success" renders as .alert-success
  readonly resetSuccessAlert: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = this.page.getByLabel('Email address');
    this.passwordInput = this.page.getByLabel('Password').first();
    this.signInButton = this.page.getByRole('button', { name: 'Sign In' });
    this.errorAlert = this.page.getByRole('alert').filter({ hasText: /invalid|error|please fill/i });

    this.forgotPasswordLink = this.page.getByRole('button', { name: 'Forgot Password?' });
    this.resetModal = this.page.getByRole('dialog');
    this.resetEmailInput = this.resetModal.getByLabel('Email');
    this.sendResetButton = this.resetModal.getByRole('button', { name: 'Send Reset Link' });
    this.resetSuccessAlert = this.resetModal.locator('.alert-success');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectDashboard(): Promise<void> {
    await this.page.waitForURL('**/dashboard', { timeout: 15_000 });
  }

  async expectSuperAdminPanel(): Promise<void> {
    await this.page.waitForURL('**/superadmin', { timeout: 15_000 });
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
