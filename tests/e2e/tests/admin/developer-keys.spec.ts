import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';

// WARNING: DK-03 resets the organization's API secret.
// After DK-03 runs, credentials.apiSecret in the credentials file is stale.
// Any subsequent test that uses credentials.apiSecret for API key auth will get 401.
//
// Mitigation: RL-04 in rate-limiting.spec.ts intentionally uses a wrong secret (so it's unaffected).
//             RL-03 uses JWT Bearer auth (not API secret) for the same reason.
//             If you add a new test that relies on credentials.apiSecret, run it before this file
//             or refresh the secret in your test setup.
//
// test.describe.serial ensures DK-01 (reads key) always runs before DK-03 (resets secret)
// within this file, even if Playwright's parallel scheduler is enabled.
test.describe.serial('Developer Keys', () => {
  test.use({ storageState: ADMIN_STATE });

  test('DK-01: API key is displayed and matches stored credential', async ({
    developerPage,
    credentials,
  }) => {
    await developerPage.goto();
    const displayed = await developerPage.getApiKey();
    expect(displayed).toBeTruthy();
    expect(displayed).toBe(credentials.apiKey);
  });

  test('DK-02: wrong password during reset shows error alert', async ({ developerPage }) => {
    await developerPage.goto();
    await developerPage.openResetModal();
    await developerPage.confirmReset('WrongPassword123!');
    await expect(developerPage.resetErrorAlert).toBeVisible();
    await expect(developerPage.resetErrorAlert).toContainText(/incorrect password/i);
  });

  test('DK-03: correct password reveals new secret (MUTATES apiSecret — runs last)', async ({
    developerPage,
    credentials,
  }) => {
    await developerPage.goto();
    await developerPage.openResetModal();
    await developerPage.confirmReset(credentials.admin.password);

    // New secret is displayed in the one-time reveal input
    await expect(developerPage.newSecretDisplay).toBeVisible({ timeout: 5_000 });
    const newSecret = await developerPage.getNewSecret();
    expect(newSecret).toBeTruthy();
    expect(newSecret).not.toBe(credentials.apiSecret);

    await developerPage.closeModal();
    // credentials.apiSecret is now stale — see WARNING at top of file
  });
});
