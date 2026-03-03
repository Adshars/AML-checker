import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CheckPage } from '../pages/CheckPage';
import { HistoryPage } from '../pages/HistoryPage';
import { UsersPage } from '../pages/UsersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DeveloperPage } from '../pages/DeveloperPage';
import { SuperAdminPage } from '../pages/SuperAdminPage';
import { loadCredentials } from '../utils/credentials';
import { Credentials } from '../constants/auth';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  checkPage: CheckPage;
  historyPage: HistoryPage;
  usersPage: UsersPage;
  settingsPage: SettingsPage;
  developerPage: DeveloperPage;
  superAdminPage: SuperAdminPage;
  credentials: Credentials;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  checkPage: async ({ page }, use) => use(new CheckPage(page)),
  historyPage: async ({ page }, use) => use(new HistoryPage(page)),
  usersPage: async ({ page }, use) => use(new UsersPage(page)),
  settingsPage: async ({ page }, use) => use(new SettingsPage(page)),
  developerPage: async ({ page }, use) => use(new DeveloperPage(page)),
  superAdminPage: async ({ page }, use) => use(new SuperAdminPage(page)),
  credentials: async ({}, use) => use(loadCredentials()),
});

export { expect } from '@playwright/test';
