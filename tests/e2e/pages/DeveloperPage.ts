import { Page, Locator } from '@playwright/test';

export class DeveloperPage {
  readonly apiKeyDisplay: Locator;
  readonly copyApiKeyBtn: Locator;
  readonly resetSecretBtn: Locator;
  readonly resetErrorAlert: Locator;
  readonly newSecretDisplay: Locator;
  readonly copySecretBtn: Locator;

  private readonly resetModal: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly confirmBtn: Locator;

  constructor(private readonly page: Page) {
    this.apiKeyDisplay = this.page.getByTestId('api-key-display');
    this.copyApiKeyBtn = this.page.getByTestId('copy-api-key-btn');
    this.resetSecretBtn = this.page.getByTestId('reset-secret-btn');
    this.resetErrorAlert = this.page.getByTestId('reset-error-alert');
    this.newSecretDisplay = this.page.getByTestId('new-secret-display');
    this.copySecretBtn = this.page.getByTestId('copy-secret-btn');

    this.resetModal = this.page.getByRole('dialog');
    this.confirmPasswordInput = this.resetModal.getByLabel('Enter your password to confirm');
    this.confirmBtn = this.resetModal.getByRole('button', { name: 'Confirm' });
  }

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
