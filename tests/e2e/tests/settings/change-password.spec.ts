import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import { apiCreateUser } from '../../utils/apiHelper';
import { userPayload, strongPassword } from '../../utils/testData';

test.describe('Change Password — shared admin session', () => {
  test.use({ storageState: ADMIN_STATE });

  test('CP-02: wrong current password shows error alert', async ({ settingsPage }) => {
    await settingsPage.goto();
    await settingsPage.changePassword('WrongCurrent123!', 'NewPassword1!');
    await expect(settingsPage.errorAlert).toBeVisible();
  });

  test('CP-03: mismatched new passwords show client-side error', async ({ settingsPage }) => {
    await settingsPage.goto();
    await settingsPage.changePassword('anyPass1!', 'NewPassword1!', 'DifferentPassword2!');
    await expect(settingsPage.errorAlert).toBeVisible();
    await expect(settingsPage.errorAlert).toContainText('do not match');
  });
});

test.describe('Change Password — isolated user', () => {
  // No storageState — this describe block logs in as a throwaway user via the browser.
  // We use loginPage/settingsPage fixtures directly; the fixtures are plain POM wrappers
  // with no storageState baked in — storageState is controlled only by test.use() above.
  test('CP-01: valid change shows success alert and keeps user on /settings', async ({
    loginPage,
    settingsPage,
    page,
    credentials,
  }) => {
    // Create a throwaway user so we do not mutate the shared admin password.
    // Use the pre-fetched adminToken — avoids an extra /auth/login that would
    // count against the authLimiter (max 20 per 15 min shared with all auth endpoints).
    const isolatedUser = userPayload();
    await apiCreateUser(credentials.adminToken, isolatedUser);

    // Log in as the isolated user
    await loginPage.goto();
    await loginPage.login(isolatedUser.email, isolatedUser.password);
    await loginPage.expectDashboard();

    // Change password
    await settingsPage.goto();
    await settingsPage.changePassword(isolatedUser.password, strongPassword());

    await expect(settingsPage.successAlert).toBeVisible();
    await expect(page).toHaveURL(/\/settings/);
  });
});
