import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import { loadCredentials } from '../../utils/credentials';
import { seedSanctionsChecks } from '../../utils/apiHelper';

// Seed enough rows to verify the table before running any test.
// Uses the pre-fetched adminToken from credentials (no extra /auth/login,
// which would hit the authLimiter shared with all other auth endpoints).
test.beforeAll(async () => {
  const creds = loadCredentials();
  await seedSanctionsChecks(creds.adminToken, 5, 'HistoryE2E');
});

test.describe('History', () => {
  test.use({ storageState: ADMIN_STATE });

  test('HI-01: page loads and history table is visible', async ({ historyPage }) => {
    await historyPage.goto();
    await expect(historyPage.historyTable).toBeVisible();
  });

  test('HI-02: seeded queries appear as rows in the table', async ({ historyPage }) => {
    await historyPage.goto();
    const count = await historyPage.rowCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('HI-03: search filter narrows results', async ({ historyPage }) => {
    await historyPage.goto();
    const totalBefore = await historyPage.rowCount();

    // Filter by the unique seed prefix used in beforeAll
    await historyPage.applyFilters({ search: 'HistoryE2E' });
    await historyPage.historyTable.waitFor({ state: 'visible' });

    const filtered = await historyPage.rowCount();
    // Must have at least 1 result (we seeded with that prefix) and no more than the total
    expect(filtered).toBeGreaterThanOrEqual(1);
    expect(filtered).toBeLessThanOrEqual(totalBefore);
  });

  test('HI-04: clear filter restores full result set', async ({ historyPage }) => {
    await historyPage.goto();
    await historyPage.applyFilters({ search: 'HistoryE2E' });
    await historyPage.historyTable.waitFor({ state: 'visible' });
    const filtered = await historyPage.rowCount();

    await historyPage.clearFilters();
    await historyPage.historyTable.waitFor({ state: 'visible' });
    const after = await historyPage.rowCount();

    expect(after).toBeGreaterThanOrEqual(filtered);
  });

  test('HI-05: details modal opens and closes', async ({ historyPage }) => {
    await historyPage.goto();
    const count = await historyPage.rowCount();
    expect(count).toBeGreaterThanOrEqual(1);

    await historyPage.openDetails(0);
    await expect(historyPage.detailsModal).toBeVisible();

    await historyPage.closeDetails();
    await expect(historyPage.detailsModal).toBeHidden();
  });

  test('HI-06: status filter "hit" shows no CLEAN-badged rows', async ({ historyPage, page }) => {
    await historyPage.goto();
    await historyPage.applyFilters({ status: 'hit' });
    await historyPage.historyTable.waitFor({ state: 'visible' });

    // Use text-based locator — more robust than .badge.bg-success CSS class
    const cleanBadges = page
      .getByTestId('history-row')
      .locator('.badge')
      .filter({ hasText: 'CLEAN' });
    await expect(cleanBadges).toHaveCount(0);
  });
});
