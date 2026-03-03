import { Page } from '@playwright/test';

export class SuperAdminPage {
  private readonly orgNameInput = this.page.getByLabel('Organization Name');
  private readonly countryInput = this.page.getByLabel('Country');
  private readonly cityInput = this.page.getByLabel('City');
  private readonly addressInput = this.page.getByLabel('Address');
  private readonly firstNameInput = this.page.getByLabel('First Name');
  private readonly lastNameInput = this.page.getByLabel('Last Name');
  private readonly emailInput = this.page.getByLabel('Email');
  private readonly passwordInput = this.page.getByLabel('Password');
  private readonly submitBtn = this.page.getByRole('button', { name: 'Register Organization' });
  readonly successAlert = this.page.getByRole('alert').filter({ hasText: /created successfully/i });
  // Bootstrap variant="danger" -> .alert-danger; text-based filter is unreliable because the
  // error message ("Email already registered") does not contain "error" or "failed"
  readonly errorAlert = this.page.locator('.alert-danger');

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/superadmin');
    await this.submitBtn.waitFor({ state: 'visible' });
  }

  async fillForm(data: {
    orgName: string;
    country: string;
    city: string;
    address: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.orgNameInput.fill(data.orgName);
    await this.countryInput.fill(data.country);
    await this.cityInput.fill(data.city);
    await this.addressInput.fill(data.address);
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  async submit(): Promise<void> {
    await this.submitBtn.click();
  }

  async registerOrg(data: {
    orgName: string;
    country: string;
    city: string;
    address: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.fillForm(data);
    await this.submit();
    await this.successAlert.waitFor({ state: 'visible' });
  }
}
