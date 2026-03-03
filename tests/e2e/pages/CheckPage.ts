import { Page, Route } from '@playwright/test';

export class CheckPage {
  private readonly entityInput = this.page.getByTestId('screening-input');
  readonly checkBtn = this.page.getByTestId('check-btn');
  readonly resultClean = this.page.getByTestId('result-clean');
  readonly resultHit = this.page.getByTestId('result-hit');
  readonly entityItems = this.page.getByTestId('entity-item');
  readonly entityModal = this.page.getByTestId('entity-modal');
  readonly entityModalClose = this.page.getByTestId('entity-modal-close');

  constructor(private readonly page: Page) {}

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
