import { Page, Locator, expect } from '@playwright/test';

export type IdentityModeLabel =
  | 'None'
  | 'Identity verification'
  | 'Full AML (identity + automatic sanctions screening)';

/**
 * SuperAdmin organization list (/superadmin) and details (/superadmin/organizations/:id)
 */
export class SuperAdminOrganizationsPage {
  readonly table: Locator;
  readonly rows: Locator;
  private readonly searchInput: Locator;
  // Details view
  readonly organizationName: Locator;
  private readonly sanctionsCheckbox: Locator;
  private readonly saveBtn: Locator;
  private readonly confirmModal: Locator;
  private readonly confirmBtn: Locator;
  readonly successToast: Locator;

  constructor(private readonly page: Page) {
    this.table = this.page.getByTestId('organizations-table');
    this.rows = this.page.getByTestId('organization-row');
    this.searchInput = this.page.getByTestId('organizations-search');
    this.organizationName = this.page.getByTestId('organization-name');
    // exact: the Full AML label also contains "sanctions screening"
    this.sanctionsCheckbox = this.page.getByLabel('Sanctions screening', { exact: true });
    this.saveBtn = this.page.getByTestId('save-services-btn');
    this.confirmModal = this.page.getByTestId('confirm-services-modal');
    this.confirmBtn = this.page.getByTestId('confirm-services-btn');
    this.successToast = this.page.getByText('Organization services updated');
  }

  async goto(): Promise<void> {
    await this.page.goto('/superadmin');
    await this.table.waitFor({ state: 'visible' });
  }

  async search(name: string): Promise<void> {
    await this.searchInput.fill(name);
    // Debounced search: wait until only matching rows remain
    await expect(this.rows.first()).toContainText(name, { timeout: 10_000 });
  }

  rowFor(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  async openOrganization(name: string): Promise<void> {
    await this.rowFor(name).click();
    await expect(this.organizationName).toHaveText(name);
  }

  async setSanctions(enabled: boolean): Promise<void> {
    await this.sanctionsCheckbox.setChecked(enabled);
  }

  async setIdentityMode(label: IdentityModeLabel): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).check();
  }

  async saveWithConfirmation(): Promise<void> {
    await this.saveBtn.click();
    await this.confirmModal.waitFor({ state: 'visible' });
    await this.confirmBtn.click();
    await expect(this.successToast).toBeVisible();
    await expect(this.confirmModal).toBeHidden();
  }
}
