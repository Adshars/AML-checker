import { Page, Locator } from '@playwright/test';

export class UsersPage {
  readonly addUserBtn: Locator;
  readonly usersTable: Locator;
  readonly userRows: Locator;
  readonly deleteUserBtns: Locator;

  private readonly addUserModal: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly cancelAddBtn: Locator;
  private readonly saveUserBtn: Locator;

  private readonly confirmDeleteModal: Locator;
  readonly confirmDeleteBtn: Locator;

  constructor(private readonly page: Page) {
    this.addUserBtn = this.page.getByTestId('add-user-btn');
    this.usersTable = this.page.getByTestId('users-table');
    this.userRows = this.page.getByTestId('user-row');
    this.deleteUserBtns = this.page.getByTestId('delete-user-btn');

    this.addUserModal = this.page.getByTestId('add-user-modal');
    this.firstNameInput = this.addUserModal.getByLabel('First Name');
    this.lastNameInput = this.addUserModal.getByLabel('Last Name');
    this.emailInput = this.addUserModal.getByLabel('Email');
    this.passwordInput = this.addUserModal.getByLabel('Password');
    this.cancelAddBtn = this.page.getByTestId('cancel-add-user-btn');
    this.saveUserBtn = this.page.getByTestId('save-user-btn');

    this.confirmDeleteModal = this.page.getByTestId('confirm-delete-modal');
    this.confirmDeleteBtn = this.page.getByTestId('confirm-delete-btn');
  }

  async goto(): Promise<void> {
    await this.page.goto('/users');
    await this.addUserBtn.waitFor({ state: 'visible' });
  }

  async openAddUserModal(): Promise<void> {
    await this.addUserBtn.click();
    await this.addUserModal.waitFor({ state: 'visible' });
  }

  async fillAddUserForm(user: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.firstNameInput.fill(user.firstName);
    await this.lastNameInput.fill(user.lastName);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
  }

  async submitAddUser(): Promise<void> {
    await this.saveUserBtn.click();
    await this.addUserModal.waitFor({ state: 'hidden' });
  }

  async cancelAddUser(): Promise<void> {
    await this.cancelAddBtn.click();
    await this.addUserModal.waitFor({ state: 'hidden' });
  }

  async deleteUserByIndex(index: number): Promise<void> {
    await this.deleteUserBtns.nth(index).click();
    await this.confirmDeleteModal.waitFor({ state: 'visible' });
    await this.confirmDeleteBtn.click();
    await this.confirmDeleteModal.waitFor({ state: 'hidden' });
  }

  async rowCount(): Promise<number> {
    return this.userRows.count();
  }
}
