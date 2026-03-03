import { test, expect } from '../../fixtures/base.fixture';
import { SUPERADMIN_STATE } from '../../constants/auth';
import { orgPayload } from '../../utils/testData';

test.describe('Register Organization', () => {
  test.use({ storageState: SUPERADMIN_STATE });

  test('SA-01: valid registration shows success alert with org name', async ({
    superAdminPage,
  }) => {
    await superAdminPage.goto();
    const data = orgPayload();
    await superAdminPage.fillForm(data);
    await superAdminPage.submit();
    await expect(superAdminPage.successAlert).toBeVisible();
    await expect(superAdminPage.successAlert).toContainText('created successfully');
    await expect(superAdminPage.successAlert).toContainText(data.email);
  });

  test('SA-02: duplicate admin email shows error alert', async ({
    superAdminPage,
    credentials,
  }) => {
    await superAdminPage.goto();
    // Use the already-registered admin email to trigger a conflict
    const data = orgPayload(credentials.admin.email);
    await superAdminPage.fillForm(data);
    await superAdminPage.submit();
    await expect(superAdminPage.errorAlert).toBeVisible();
  });

  test('SA-03: missing required fields keeps user on /superadmin (HTML5 validation)', async ({
    page,
    superAdminPage,
  }) => {
    await superAdminPage.goto();
    // Click submit with an empty form — HTML5 required attributes prevent submission
    await page.getByRole('button', { name: 'Register Organization' }).click();
    await expect(page).toHaveURL(/\/superadmin/);
  });
});
