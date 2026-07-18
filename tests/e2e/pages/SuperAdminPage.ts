import { Page, Locator } from '@playwright/test';

export class SuperAdminPage {
  private readonly orgNameInput: Locator;
  private readonly countryInput: Locator;
  private readonly cityInput: Locator;
  private readonly addressInput: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitBtn: Locator;
  readonly successAlert: Locator;
  // Bootstrap variant="danger" -> .alert-danger; text-based filter is unreliable because the
  // error message ("Email already registered") does not contain "error" or "failed"
  readonly errorAlert: Locator;

  constructor(private readonly page: Page) {
    this.orgNameInput = this.page.getByLabel('Organization Name');
    this.countryInput = this.page.getByLabel('Country');
    this.cityInput = this.page.getByLabel('City');
    this.addressInput = this.page.getByLabel('Address');
    this.firstNameInput = this.page.getByLabel('First Name');
    this.lastNameInput = this.page.getByLabel('Last Name');
    this.emailInput = this.page.getByLabel('Email');
    this.passwordInput = this.page.getByLabel('Password');
    this.submitBtn = this.page.getByRole('button', { name: 'Register Organization' });
    this.successAlert = this.page.getByRole('alert').filter({ hasText: /created successfully/i });
    this.errorAlert = this.page.locator('.alert-danger');
  }

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
