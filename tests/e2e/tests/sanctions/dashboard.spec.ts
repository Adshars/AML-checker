import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE, USER_STATE } from '../../constants/auth';

test.describe('Dashboard — stats and layout', () => {
  test.use({ storageState: ADMIN_STATE });

  test('DB-01: dashboard loads and shows all three stat cards', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.totalChecks).toBeVisible();
    await expect(dashboardPage.sanctionHits).toBeVisible();
    await expect(dashboardPage.pepHits).toBeVisible();
  });

  test('DB-02: stat values are non-negative integers', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const total = await dashboardPage.getStatValue('stat-total-checks');
    const sanctions = await dashboardPage.getStatValue('stat-sanction-hits');
    const pep = await dashboardPage.getStatValue('stat-pep-hits');

    expect(total).toBeGreaterThanOrEqual(0);
    expect(sanctions).toBeGreaterThanOrEqual(0);
    expect(pep).toBeGreaterThanOrEqual(0);
    expect(sanctions + pep).toBeLessThanOrEqual(total);
  });

  test('DB-03: admin nav shows Users and Developer links', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.navDashboard).toBeVisible();
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await expect(page.getByTestId('nav-developer')).toBeVisible();
    await expect(page.getByTestId('nav-check')).toBeVisible();
    await expect(page.getByTestId('nav-history')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });
});

test.describe('Dashboard — regular user nav', () => {
  test.use({ storageState: USER_STATE });

  test('DB-04: regular user does NOT see Users or Developer nav links', async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.goto();
    await expect(page.getByTestId('nav-users')).not.toBeVisible();
    await expect(page.getByTestId('nav-developer')).not.toBeVisible();
    // Common links are still visible
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-check')).toBeVisible();
    await expect(page.getByTestId('nav-history')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });
});

test.describe('Dashboard — logout', () => {
  test.use({ storageState: ADMIN_STATE });

  test('DB-05: logout button redirects to /login', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.logoutButton.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
