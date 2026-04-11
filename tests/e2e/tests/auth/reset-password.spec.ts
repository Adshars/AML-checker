import { test, expect } from '../../fixtures/base.fixture';

// No storageState — reset-password is a public page

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost';

test.describe('Reset Password page', () => {
  test('RP-01: navigating without URL params shows an error alert immediately', async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password`);
    // useEffect fires on mount and sets error message when token/id are missing
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('alert')).toContainText(/missing|invalid/i);
  });

  test('RP-02: mismatched passwords show client-side error', async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password?token=sometoken&id=someid`);

    await page.getByLabel('New Password').fill('NewPassword1!');
    await page.getByLabel('Confirm Password').fill('DifferentPassword2!');
    await page.getByRole('button', { name: /set new password/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('alert')).toContainText('do not match');
  });

  test('RP-03: submitting with an invalid token shows a server-side error', async ({ page }) => {
    // Any non-existent userId / token pair will get 400 from auth-service
    await page.goto(`${BASE_URL}/reset-password?token=completelyinvalidtoken&id=000000000000000000000001`);

    await page.getByLabel('New Password').fill('NewPassword1!');
    await page.getByLabel('Confirm Password').fill('NewPassword1!');
    await page.getByRole('button', { name: /set new password/i }).click();

    // Should show the error returned by the API, not navigate away
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test('RP-04: Set New Password button is disabled while request is in flight', async ({ page }) => {
    // Slow down the network so the loading state is observable
    await page.route('**/auth/reset-password', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid token' }) });
    });

    await page.goto(`${BASE_URL}/reset-password?token=slowtoken&id=000000000000000000000001`);

    await page.getByLabel('New Password').fill('NewPassword1!');
    await page.getByLabel('Confirm Password').fill('NewPassword1!');

    const submitBtn = page.getByRole('button', { name: /set new password/i });
    await submitBtn.click();

    // Button text changes to "Setting..." and becomes disabled during the request
    await expect(page.getByRole('button', { name: /setting/i })).toBeDisabled({ timeout: 2_000 });
  });
});
