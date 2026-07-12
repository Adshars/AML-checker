import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly totalChecks: Locator;
  readonly sanctionHits: Locator;
  readonly pepHits: Locator;
  readonly recentActivityTable: Locator;
  readonly navDashboard: Locator;
  readonly navUsers: Locator;
  readonly navDeveloper: Locator;
  readonly navSettings: Locator;
  readonly navNewOrg: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.totalChecks = this.page.getByTestId('stat-total-checks');
    this.sanctionHits = this.page.getByTestId('stat-sanction-hits');
    this.pepHits = this.page.getByTestId('stat-pep-hits');
    this.recentActivityTable = this.page.getByTestId('recent-activity-table');
    this.navDashboard = this.page.getByTestId('nav-dashboard');
    this.navUsers = this.page.getByTestId('nav-users');
    this.navDeveloper = this.page.getByTestId('nav-developer');
    this.navSettings = this.page.getByTestId('nav-settings');
    this.navNewOrg = this.page.getByTestId('nav-new-org');
    this.logoutButton = this.page.getByTestId('logout-btn');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.totalChecks.waitFor({ state: 'visible' });
  }

  async getStatValue(testId: string): Promise<number> {
    const text = await this.page.getByTestId(testId).textContent();
    return parseInt(text ?? '0', 10);
  }
}
