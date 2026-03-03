import { Page } from '@playwright/test';

export class DashboardPage {
  readonly totalChecks = this.page.getByTestId('stat-total-checks');
  readonly sanctionHits = this.page.getByTestId('stat-sanction-hits');
  readonly pepHits = this.page.getByTestId('stat-pep-hits');
  readonly recentActivityTable = this.page.getByTestId('recent-activity-table');
  readonly navDashboard = this.page.getByTestId('nav-dashboard');
  readonly navUsers = this.page.getByTestId('nav-users');
  readonly navDeveloper = this.page.getByTestId('nav-developer');
  readonly navSettings = this.page.getByTestId('nav-settings');
  readonly navNewOrg = this.page.getByTestId('nav-new-org');
  readonly logoutButton = this.page.getByTestId('logout-btn');

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.totalChecks.waitFor({ state: 'visible' });
  }

  async getStatValue(testId: string): Promise<number> {
    const text = await this.page.getByTestId(testId).textContent();
    return parseInt(text ?? '0', 10);
  }
}
