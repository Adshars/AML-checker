import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import { userPayload } from '../../utils/testData';

// NOTE: getUsersByOrganization excludes ADMIN and SUPERADMIN roles from the table.
// The admin's own row never appears in the UI, so a self-delete UI test is not possible.
// The controller-level guard (DELETE /users/:id -> 400 "Cannot delete your own account")
// is verified by UserController unit tests.

test.describe('Users Management', () => {
  test.use({ storageState: ADMIN_STATE });

  test('UM-01: page loads and table shows at least one member', async ({ usersPage }) => {
    await usersPage.goto();
    await expect(usersPage.usersTable).toBeVisible();
    const count = await usersPage.rowCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('UM-02: adding a user increases table row count by 1', async ({ usersPage }) => {
    await usersPage.goto();
    const before = await usersPage.rowCount();
    const newUser = userPayload();

    await usersPage.openAddUserModal();
    await usersPage.fillAddUserForm(newUser);
    await usersPage.submitAddUser();

    const after = await usersPage.rowCount();
    expect(after).toBe(before + 1);
  });

  test('UM-03: cancelling add-user modal leaves count unchanged', async ({ usersPage }) => {
    await usersPage.goto();
    const before = await usersPage.rowCount();

    await usersPage.openAddUserModal();
    await usersPage.cancelAddUser();

    const after = await usersPage.rowCount();
    expect(after).toBe(before);
  });

  test('UM-04: adding user with duplicate email shows error alert', async ({
    page,
    usersPage,
    credentials,
  }) => {
    // credentials.user is in the same org — reusing their email triggers
    // ConflictError('Email already registered') -> 400 -> error shown on page
    await usersPage.goto();
    await usersPage.openAddUserModal();
    await usersPage.fillAddUserForm({ ...userPayload(), email: credentials.user.email });

    // Click Save directly — submitAddUser() waits for modal to close (success path only)
    await page.getByTestId('save-user-btn').click();

    await expect(
      page.getByRole('alert').filter({ hasText: /already/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('UM-05: deleting a user removes their row from the table', async ({ page, usersPage }) => {
    await usersPage.goto();

    // Add a fresh user so we have a known, deletable row
    const newUser = userPayload();
    await usersPage.openAddUserModal();
    await usersPage.fillAddUserForm(newUser);
    await usersPage.submitAddUser();

    // Locate the new user's row by their unique email
    const userRow = page.getByTestId('user-row').filter({ hasText: newUser.email });
    await expect(userRow).toBeVisible();

    // Delete via the row's delete button -> confirm in modal
    await userRow.getByTestId('delete-user-btn').click();
    await page.getByTestId('confirm-delete-modal').waitFor({ state: 'visible' });
    await page.getByTestId('confirm-delete-btn').click();
    await page.getByTestId('confirm-delete-modal').waitFor({ state: 'hidden' });

    await expect(userRow).not.toBeVisible();
  });
});
