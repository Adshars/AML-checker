import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 1 worker locally: prevents parallel /auth/refresh storms that hit the gateway's
  // authLimiter (max 20/15 min). CI can use more workers if the limit is raised there.
  workers: process.env.CI ? 4 : 1,
  reporter: [
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
    ['list'],
  ],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
