import { test, expect } from '../../fixtures/base.fixture';
import { ADMIN_STATE } from '../../constants/auth';
import {
  MOCK_CLEAN_RESPONSE,
  MOCK_HIT_RESPONSE,
  MOCK_PEP_RESPONSE,
} from '../../mocks/sanctionsResponses';

test.describe('Sanctions Check', () => {
  test.use({ storageState: ADMIN_STATE });

  test('SC-01: clean result shows CLEAN alert', async ({ checkPage }) => {
    await checkPage.mockRoute(MOCK_CLEAN_RESPONSE);
    await checkPage.goto();
    await checkPage.searchFor('Jan Kowalski');
    await expect(checkPage.resultClean).toBeVisible();
    await expect(checkPage.resultHit).not.toBeVisible();
  });

  test('SC-02: sanction hit shows HIT alert and entity list', async ({ checkPage }) => {
    await checkPage.mockRoute(MOCK_HIT_RESPONSE);
    await checkPage.goto();
    await checkPage.searchFor('Vladimir Putin');
    await expect(checkPage.resultHit).toBeVisible();
    await expect(checkPage.entityItems.first()).toBeVisible();
    await expect(checkPage.resultClean).not.toBeVisible();
  });

  test('SC-03: clicking entity item opens details modal, Close button hides it', async ({
    checkPage,
  }) => {
    await checkPage.mockRoute(MOCK_HIT_RESPONSE);
    await checkPage.goto();
    await checkPage.searchFor('Vladimir Putin');
    await expect(checkPage.entityItems.first()).toBeVisible();

    await checkPage.openEntityDetails(0);
    await expect(checkPage.entityModal).toBeVisible();

    await checkPage.closeEntityModal();
    await expect(checkPage.entityModal).toBeHidden();
  });

  test('SC-04: PEP result shows HIT alert (hits_count > 0)', async ({ checkPage }) => {
    await checkPage.mockRoute(MOCK_PEP_RESPONSE);
    await checkPage.goto();
    await checkPage.searchFor('Test PEP Person');
    await expect(checkPage.resultHit).toBeVisible();
    // Entity should carry PEP badge
    await expect(checkPage.entityItems.first()).toContainText('PEP');
  });
});
