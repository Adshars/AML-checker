import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import { loadCredentials } from '../../utils/credentials';
import { seedSanctionsChecks } from '../../utils/apiHelper';

// Uses a unique prefix so the export's content can be verified without
// depending on rows seeded by other spec files.
const SEED_PREFIX = 'HistoryExportE2E';

test.beforeAll(async () => {
  const creds = loadCredentials();
  await seedSanctionsChecks(creds.adminToken, 3, SEED_PREFIX);
});

test.describe('History CSV export', () => {
  test.use({ storageState: ADMIN_STATE });

  test('HX-01: Export CSV button is visible on the History page', async ({ historyPage }) => {
    await historyPage.goto();
    await expect(historyPage.exportCsvBtn).toBeVisible();
  });

  test('HX-02: exporting with the search filter downloads a matching CSV file', async ({
    historyPage,
    page,
  }) => {
    await historyPage.goto();
    await historyPage.applyFilters({ search: SEED_PREFIX });
    await historyPage.historyTable.waitFor({ state: 'visible' });

    const downloadPromise = page.waitForEvent('download');
    await historyPage.exportCsvBtn.click();
    const download = await downloadPromise;

    // Strict date-based pattern — must not fall back to the generic
    // "aml-history-export.csv" default (that would mean the browser
    // couldn't read the Content-Disposition header, e.g. missing CORS
    // exposedHeaders).
    expect(download.suggestedFilename()).toMatch(/^aml-history-\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    // UTF-8 BOM, for Polish-locale Excel compatibility.
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content).toContain('Date;User;Search Query;Result;Entity Name;Countries;Datasets');
    expect(content).toContain(SEED_PREFIX);
  });
});
