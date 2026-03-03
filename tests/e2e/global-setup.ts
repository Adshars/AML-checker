import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AUTH_DIR, CREDENTIALS_PATH, Credentials } from './constants/auth';
import { apiLogin, apiRegisterOrg, apiCreateUser } from './utils/apiHelper';
import { orgPayload, uniqueEmail, strongPassword } from './utils/testData';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost';

async function loginAndSaveState(
  email: string,
  password: string,
  filename: string
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect after login
  await page.waitForURL(/\/(dashboard|superadmin)/, { timeout: 15_000 });

  await context.storageState({ path: path.join(AUTH_DIR, filename) });
  await browser.close();
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const saEmail = process.env.E2E_SUPERADMIN_EMAIL!;
  const saPassword = process.env.E2E_SUPERADMIN_PASSWORD!;

  // 1. Superadmin token via API
  const saToken = await apiLogin(saEmail, saPassword);

  // 2. Register unique test organization
  const adminPassword = strongPassword();
  const payload = orgPayload(uniqueEmail('e2e.admin'));
  const org = await apiRegisterOrg(saToken, { ...payload, password: adminPassword });

  // 3. Admin token
  const adminToken = await apiLogin(org.adminEmail, adminPassword);

  // 4. Create regular user in test org
  const userEmail = uniqueEmail('e2e.user');
  const userPassword = strongPassword();
  await apiCreateUser(adminToken, {
    firstName: 'E2E',
    lastName: 'User',
    email: userEmail,
    password: userPassword,
  });

  // 5. Persist credentials for test files
  const credentials: Credentials = {
    superadmin: { email: saEmail, password: saPassword },
    admin: { email: org.adminEmail, password: adminPassword, orgId: org.orgId },
    user: { email: userEmail, password: userPassword },
    apiKey: org.apiKey,
    apiSecret: org.apiSecret,
    // Pre-fetched JWT — lets tests call /sanctions/check or /users without a
    // second /auth/login, keeping the total authLimiter hit-count under 20/15 min.
    adminToken,
  };
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));

  // 6. Save browser storageState for each role (captures JWT + HttpOnly cookies)
  await loginAndSaveState(saEmail, saPassword, 'superadmin.json');
  await loginAndSaveState(org.adminEmail, adminPassword, 'admin.json');
  await loginAndSaveState(userEmail, userPassword, 'user.json');

  console.log('[global-setup] Auth states saved. Test org:', org.orgId);
}
