import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Page stubs keep this test focused on routing rules
vi.mock('../pages/LoginPage', () => ({ default: () => <div>Login page</div> }));
vi.mock('../pages/ResetPasswordPage', () => ({ default: () => <div>Reset page</div> }));
vi.mock('../pages/DashboardPage', () => ({ default: () => <div>Dashboard page</div> }));
vi.mock('../pages/CheckPage', () => ({ default: () => <div>Check page</div> }));
vi.mock('../pages/HistoryPage', () => ({ default: () => <div>History page</div> }));
vi.mock('../pages/UsersPage', () => ({ default: () => <div>Users page</div> }));
vi.mock('../pages/SettingsPage', () => ({ default: () => <div>Settings page</div> }));
vi.mock('../pages/DeveloperPage', () => ({ default: () => <div>Developer page</div> }));
vi.mock('../pages/SuperAdminPage', () => ({ default: () => <div>New organization page</div> }));
vi.mock('../pages/SuperAdminOrganizationsPage', () => ({ default: () => <div>Organizations list page</div> }));
vi.mock('../pages/SuperAdminOrganizationDetailsPage', () => ({ default: () => <div>Organization details page</div> }));

import { AppRoutes } from '../App';

const ADMIN = { email: 'admin@test.pl', role: 'admin' };
const SUPERADMIN = { email: 'sa@test.pl', role: 'superadmin' };
const WITH_SANCTIONS = { sanctions: true, identityMode: 'NONE' };
const WITHOUT_SANCTIONS = { sanctions: false, identityMode: 'IDENTITY' };

const renderAt = (path, { user = ADMIN, services = WITH_SANCTIONS } = {}) =>
  render(
    <AuthContext.Provider value={{ user, services, loading: false, logout: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('AppRoutes', () => {
  it('redirects / to /dashboard when sanctions screening is enabled', () => {
    renderAt('/');
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('redirects / to /settings when sanctions screening is disabled', () => {
    renderAt('/', { services: WITHOUT_SANCTIONS });
    expect(screen.getByText('Settings page')).toBeInTheDocument();
  });

  it('redirects / to the organizations list for a superadmin', () => {
    renderAt('/', { user: SUPERADMIN });
    expect(screen.getByText('Organizations list page')).toBeInTheDocument();
  });

  it('redirects / to /login when not signed in', () => {
    renderAt('/', { user: null });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it.each([['/dashboard'], ['/check'], ['/history']])(
    'redirects %s to the home route when sanctions screening is disabled',
    (path) => {
      renderAt(path, { services: WITHOUT_SANCTIONS });
      expect(screen.getByText('Settings page')).toBeInTheDocument();
    }
  );

  it('allows /check when sanctions screening is enabled', () => {
    renderAt('/check');
    expect(screen.getByText('Check page')).toBeInTheDocument();
  });

  it.each([['/users', 'Users page'], ['/developer', 'Developer page'], ['/settings', 'Settings page']])(
    'keeps %s available without sanctions screening',
    (path, text) => {
      renderAt(path, { services: WITHOUT_SANCTIONS });
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  );

  it.each([
    ['/superadmin', 'Organizations list page'],
    ['/superadmin/organizations/new', 'New organization page'],
    ['/superadmin/organizations/abc', 'Organization details page'],
  ])('renders %s for a superadmin inside the main layout', (path, text) => {
    renderAt(path, { user: SUPERADMIN });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('redirects a non-superadmin away from superadmin routes', () => {
    renderAt('/superadmin/organizations/new', { services: WITHOUT_SANCTIONS });
    expect(screen.getByText('Settings page')).toBeInTheDocument();
  });
});
