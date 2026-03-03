import { Page } from '@playwright/test';

export class UsersPage {
  readonly addUserBtn = this.page.getByTestId('add-user-btn');
  readonly usersTable = this.page.getByTestId('users-table');
  readonly userRows = this.page.getByTestId('user-row');
  readonly deleteUserBtns = this.page.getByTestId('delete-user-btn');

  private readonly addUserModal = this.page.getByTestId('add-user-modal');
  private readonly firstNameInput = this.addUserModal.getByLabel('First Name');
  private readonly lastNameInput = this.addUserModal.getByLabel('Last Name');
  private readonly emailInput = this.addUserModal.getByLabel('Email');
  private readonly passwordInput = this.addUserModal.getByLabel('Password');
  private readonly cancelAddBtn = this.page.getByTestId('cancel-add-user-btn');
  private readonly saveUserBtn = this.page.getByTestId('save-user-btn');

  private readonly confirmDeleteModal = this.page.getByTestId('confirm-delete-modal');
  readonly confirmDeleteBtn = this.page.getByTestId('confirm-delete-btn');

  constructor(private readonly page: Page) {}

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
