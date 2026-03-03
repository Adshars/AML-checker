import { test, expect } from '../../fixtures/base.fixture';

// No storageState — we are testing the login flow itself
test.describe('Login', () => {
  test('LG-01: admin login redirects to /dashboard', async ({ loginPage, credentials }) => {
    await loginPage.goto();
    await loginPage.login(credentials.admin.email, credentials.admin.password);
    await loginPage.expectDashboard();
  });

  test('LG-02: superadmin login redirects to /superadmin', async ({ loginPage, credentials }) => {
    await loginPage.goto();
    await loginPage.login(credentials.superadmin.email, credentials.superadmin.password);
    await loginPage.expectSuperAdminPanel();
  });

  test('LG-03: invalid credentials show error alert', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('nobody@example.com', 'WrongPass123!');
    await expect(loginPage.errorAlert).toBeVisible();
  });

  test('LG-04: empty form does not navigate away from /login', async ({ page, loginPage }) => {
    await loginPage.goto();
    // Both inputs have required — HTML5 validation fires, onSubmit never runs
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    // Confirm JS handler never ran: the React error alert should not be present
    await expect(loginPage.errorAlert).not.toBeVisible();
  });
});
