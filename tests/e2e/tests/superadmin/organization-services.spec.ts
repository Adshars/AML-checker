import { Browser, Page, request } from '@playwright/test';
import { test, expect } from '../../fixtures/base.fixture';
import { SUPERADMIN_STATE } from '../../constants/auth';
import { LoginPage } from '../../pages/LoginPage';
import { apiLogin, apiRegisterOrg } from '../../utils/apiHelper';
import { orgPayload, uniqueEmail, strongPassword } from '../../utils/testData';
import { loadCredentials } from '../../utils/credentials';

const GATEWAY = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';

// The organization is registered inside this spec, so its API key has never been used
// and is not yet in the gateway's 60 s validation cache when services change.
let org: Awaited<ReturnType<typeof apiRegisterOrg>>;
let orgName: string;

/** Fresh browser context (no stored session) -> UI login as the organization admin */
const loginAsOrgAdmin = async (browser: Browser, baseURL: string | undefined): Promise<Page> => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(org.adminEmail, org.adminPassword);
  return page;
};

test.describe.serial('Organization services', () => {
  test.use({ storageState: SUPERADMIN_STATE });

  test.beforeAll(async () => {
    const credentials = loadCredentials();
    const saToken = await apiLogin(credentials.superadmin.email, credentials.superadmin.password);
    const payload = orgPayload(uniqueEmail('e2e.services'));
    orgName = payload.orgName;
    org = await apiRegisterOrg(saToken, { ...payload, password: strongPassword() });
  });

  test('OS-01: superadmin finds the organization and switches it to identity verification only', async ({
    superAdminOrganizationsPage,
  }) => {
    await superAdminOrganizationsPage.goto();
    await superAdminOrganizationsPage.search(orgName);
    await expect(superAdminOrganizationsPage.rowFor(orgName)).toContainText('Sanctions');

    await superAdminOrganizationsPage.openOrganization(orgName);
    await superAdminOrganizationsPage.setSanctions(false);
    await superAdminOrganizationsPage.setIdentityMode('Identity verification');
    await superAdminOrganizationsPage.saveWithConfirmation();
  });

  test('OS-02: admin without sanctions screening has no Dashboard/Check/History', async ({ browser, baseURL }) => {
    const page = await loginAsOrgAdmin(browser, baseURL);

    // Home route without sanctions screening is /settings
    await page.waitForURL('**/settings', { timeout: 15_000 });
    await expect(page.getByTestId('nav-settings')).toBeVisible();
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('nav-check')).toHaveCount(0);
    await expect(page.getByTestId('nav-history')).toHaveCount(0);

    await page.goto('/check');
    await page.waitForURL('**/settings', { timeout: 15_000 });

    await page.context().close();
  });

  test('OS-03: API key of the organization gets 403 on /sanctions/check', async () => {
    const ctx = await request.newContext({ baseURL: GATEWAY });
    const res = await ctx.get('/sanctions/check', {
      params: { name: 'test' },
      headers: { 'x-api-key': org.apiKey, 'x-api-secret': org.apiSecret },
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: 'Service not enabled for organization', service: 'sanctions' });
    await ctx.dispose();
  });

  test('OS-04: restoring sanctions screening brings the menu back after a fresh login', async ({
    superAdminOrganizationsPage,
    browser,
    baseURL,
  }) => {
    await superAdminOrganizationsPage.goto();
    await superAdminOrganizationsPage.search(orgName);
    await superAdminOrganizationsPage.openOrganization(orgName);
    await superAdminOrganizationsPage.setSanctions(true);
    await superAdminOrganizationsPage.setIdentityMode('None');
    await superAdminOrganizationsPage.saveWithConfirmation();

    const page = await loginAsOrgAdmin(browser, baseURL);
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-check')).toBeVisible();
    await expect(page.getByTestId('nav-history')).toBeVisible();

    await page.context().close();
  });
});
