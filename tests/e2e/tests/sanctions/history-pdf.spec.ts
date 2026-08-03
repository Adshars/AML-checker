import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import { loadCredentials } from '../../utils/credentials';
import { seedSanctionsChecks } from '../../utils/apiHelper';

const SEED_PREFIX = 'HistoryPdfE2E';

test.beforeAll(async () => {
  const creds = loadCredentials();
  await seedSanctionsChecks(creds.adminToken, 1, SEED_PREFIX);
});

test.describe('History PDF confirmation', () => {
  test.use({ storageState: ADMIN_STATE });

  test('HP-01: Download PDF button is visible in the Log Details modal, next to Close', async ({ historyPage }) => {
    await historyPage.goto();
    await historyPage.applyFilters({ search: SEED_PREFIX });
    await historyPage.historyTable.waitFor({ state: 'visible' });

    await historyPage.openDetails(0);
    await expect(historyPage.downloadPdfBtn).toBeVisible();
  });

  test('HP-02: clicking Download PDF downloads a PDF file named aml-confirmation-<reference>-<date>.pdf', async ({
    historyPage,
    page,
  }) => {
    await historyPage.goto();
    await historyPage.applyFilters({ search: SEED_PREFIX });
    await historyPage.historyTable.waitFor({ state: 'visible' });
    await historyPage.openDetails(0);

    const downloadPromise = page.waitForEvent('download');
    await historyPage.downloadPdfBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^aml-confirmation-AML-\d{4}-[A-Z0-9]{7}-\d{4}-\d{2}-\d{2}\.pdf$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks);

    expect(content.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
