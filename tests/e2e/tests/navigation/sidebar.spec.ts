import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';

test.describe('Sidebar — collapse/expand (desktop)', () => {
  test.use({ storageState: ADMIN_STATE });

  test('SB-01: collapses the sidebar, hides labels, and persists the choice across reload', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const sidebarLabel = page.getByTestId('sidebar').getByText('Dashboard', { exact: true });
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(sidebarLabel).toBeVisible();

    await page.getByTestId('sidebar-collapse-toggle').click();
    await expect(sidebarLabel).not.toBeVisible();
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('aml_sidebar_collapsed')))
      .toBe('true');

    await page.reload();
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('sidebar').getByText('Dashboard', { exact: true })).not.toBeVisible();
  });

  test('SB-02: expands the sidebar again and persists that choice too', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebarLabel = page.getByTestId('sidebar').getByText('Dashboard', { exact: true });

    await page.getByTestId('sidebar-collapse-toggle').click();
    await expect(sidebarLabel).not.toBeVisible();

    await page.getByTestId('sidebar-collapse-toggle').click();
    await expect(sidebarLabel).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('aml_sidebar_collapsed')))
      .toBe('false');

    await page.reload();
    await expect(page.getByTestId('sidebar').getByText('Dashboard', { exact: true })).toBeVisible();
  });

  test('SB-06: user email and logout stay within the viewport on a tall page, without scrolling', async ({
    page,
  }) => {
    // Dashboard (stat cards + chart + activity table) is tall enough that the
    // sidebar must not stretch with the page — it should stay pinned to the
    // viewport so the footer (user info + logout) never needs scrolling into view.
    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-total-checks')).toBeVisible();

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const logoutBox = await page.getByTestId('logout-btn').boundingBox();
    expect(logoutBox).not.toBeNull();
    expect(logoutBox!.y).toBeGreaterThanOrEqual(0);
    expect(logoutBox!.y + logoutBox!.height).toBeLessThanOrEqual(viewportSize!.height);

    const userBox = await page.getByTestId('sidebar-user').boundingBox();
    expect(userBox).not.toBeNull();
    expect(userBox!.y).toBeGreaterThanOrEqual(0);
    expect(userBox!.y + userBox!.height).toBeLessThanOrEqual(viewportSize!.height);
  });
});

test.describe('Sidebar — narrow viewport (< 992px)', () => {
  test.use({ storageState: ADMIN_STATE, viewport: { width: 900, height: 800 } });

  test('SB-03: sidebar is hidden off-screen behind a hamburger by default', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('sidebar-hamburger-btn')).toBeVisible();

    const box = await page.getByTestId('nav-dashboard').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('sidebar-overlay')).not.toBeVisible();
  });

  test('SB-04: hamburger opens the overlay and slides the sidebar into view; backdrop closes it', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await page.getByTestId('sidebar-hamburger-btn').click();
    await expect(page.getByTestId('sidebar-overlay')).toBeVisible();

    // The sidebar slides in via a CSS transform transition; wait for it to settle.
    await expect
      .poll(async () => (await page.getByTestId('nav-dashboard').boundingBox())?.x)
      .toBeGreaterThanOrEqual(0);

    await page.getByTestId('sidebar-overlay').click();
    await expect(page.getByTestId('sidebar-overlay')).not.toBeVisible();
  });

  test('SB-05: navigating via a link inside the overlay closes it', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByTestId('sidebar-hamburger-btn').click();
    await expect(page.getByTestId('sidebar-overlay')).toBeVisible();

    await page.getByTestId('nav-check').click();

    await expect(page).toHaveURL(/\/check/);
    await expect(page.getByTestId('sidebar-overlay')).not.toBeVisible();
  });
});
