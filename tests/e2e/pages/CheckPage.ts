import { Page, Route, Locator } from '@playwright/test';

export class CheckPage {
  private readonly entityInput: Locator;
  readonly checkBtn: Locator;
  readonly resultClean: Locator;
  readonly resultHit: Locator;
  readonly entityItems: Locator;
  readonly entityModal: Locator;
  readonly entityModalClose: Locator;

  constructor(private readonly page: Page) {
    this.entityInput = this.page.getByTestId('screening-input');
    this.checkBtn = this.page.getByTestId('check-btn');
    this.resultClean = this.page.getByTestId('result-clean');
    this.resultHit = this.page.getByTestId('result-hit');
    this.entityItems = this.page.getByTestId('entity-item');
    this.entityModal = this.page.getByTestId('entity-modal');
    this.entityModalClose = this.page.getByTestId('entity-modal-close');
  }

  async goto(): Promise<void> {
    await this.page.goto('/check');
    await this.checkBtn.waitFor({ state: 'visible' });
  }

  async mockRoute(responseBody: object): Promise<void> {
    await this.page.route('**/sanctions/check**', (route: Route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(responseBody) })
    );
  }

  async searchFor(name: string): Promise<void> {
    await this.entityInput.fill(name);
    await this.checkBtn.click();
  }

  async openEntityDetails(index = 0): Promise<void> {
    await this.entityItems.nth(index).click();
    await this.entityModal.waitFor({ state: 'visible' });
  }

  async closeEntityModal(): Promise<void> {
    await this.entityModalClose.click();
    await this.entityModal.waitFor({ state: 'hidden' });
  }
}
