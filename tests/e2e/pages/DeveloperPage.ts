import { Page } from '@playwright/test';

export class DeveloperPage {
  readonly apiKeyDisplay = this.page.getByTestId('api-key-display');
  readonly copyApiKeyBtn = this.page.getByTestId('copy-api-key-btn');
  readonly resetSecretBtn = this.page.getByTestId('reset-secret-btn');
  readonly resetErrorAlert = this.page.getByTestId('reset-error-alert');
  readonly newSecretDisplay = this.page.getByTestId('new-secret-display');
  readonly copySecretBtn = this.page.getByTestId('copy-secret-btn');

  private readonly resetModal = this.page.getByRole('dialog');
  private readonly confirmPasswordInput = this.resetModal.getByLabel('Enter your password to confirm');
  private readonly confirmBtn = this.resetModal.getByRole('button', { name: 'Confirm' });

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/developer');
    await this.apiKeyDisplay.waitFor({ state: 'visible' });
  }

  async openResetModal(): Promise<void> {
    await this.resetSecretBtn.click();
    await this.resetModal.waitFor({ state: 'visible' });
  }

  async confirmReset(password: string): Promise<void> {
    await this.confirmPasswordInput.fill(password);
    await this.confirmBtn.click();
  }

  async closeModal(): Promise<void> {
    // getByRole('button', { name: 'Close' }) matches both the × icon button (aria-label="Close")
    // and the visible "Close" button — use getByText to target only the labelled button.
    await this.resetModal.getByText('Close', { exact: true }).click();
    await this.resetModal.waitFor({ state: 'hidden' });
  }

  async getApiKey(): Promise<string> {
    return (await this.apiKeyDisplay.inputValue()) ?? '';
  }

  async getNewSecret(): Promise<string> {
    return (await this.newSecretDisplay.inputValue()) ?? '';
  }
}
