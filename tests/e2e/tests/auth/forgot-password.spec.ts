import { test, expect } from '../../fixtures/base.fixture';

// No storageState — forgot password is on the public login page
test.describe('Forgot Password', () => {
  test('FP-01: clicking Forgot Password opens the reset modal', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.openForgotPasswordModal();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Reset Password');
  });

  test('FP-02: submitting a valid email closes the modal after success', async ({
    page,
    loginPage,
    credentials,
  }) => {
    await loginPage.goto();
    await loginPage.openForgotPasswordModal();
    await loginPage.submitPasswordReset(credentials.admin.email);
    // Success -> "Link sent! Check your email or logs." briefly shown, then modal auto-closes
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });

  test('FP-03: submitting a non-existent email also closes the modal (security: always 200)', async ({
    page,
    loginPage,
  }) => {
    // PasswordService.requestPasswordReset returns 200 even when email not found
    // (security best practice — does not reveal whether an account exists)
    await loginPage.goto();
    await loginPage.openForgotPasswordModal();
    await loginPage.submitPasswordReset('nonexistent@nowhere.test');
    // Same UX as success: modal closes, no account-existence information leaked
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  });
});
