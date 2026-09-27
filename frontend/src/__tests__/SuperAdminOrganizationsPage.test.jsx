import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuperAdminOrganizationsPage from '../pages/SuperAdminOrganizationsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/organizationService', () => ({
  listOrganizations: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { listOrganizations } from '../services/organizationService';
import { toast } from 'react-toastify';

const ORGS = [
  {
    id: 'org1',
    name: 'TestCorporation',
    country: 'Polska',
    city: 'Gdańsk',
    createdAt: '2026-01-15T10:00:00Z',
    services: { sanctions: true, identityMode: 'NONE' },
    userCount: 4,
  },
  {
    id: 'org2',
    name: 'Identity Only Ltd',
    country: 'UK',
    city: 'London',
    createdAt: '2026-02-01T10:00:00Z',
    services: { sanctions: false, identityMode: 'FULL_AML' },
    userCount: 1,
  },
];

const response = (data = ORGS, meta = {}) => ({
  data,
  meta: { page: 1, limit: 20, total: data.length, totalPages: 1, ...meta },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SuperAdminOrganizationsPage />
    </MemoryRouter>
  );

describe('SuperAdminOrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOrganizations.mockResolvedValue(response());
  });

  it('renders organizations with location, service badges and user counts', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('organization-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('TestCorporation')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Gdańsk, Polska')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Sanctions')).toBeInTheDocument();
    expect(within(rows[0]).getByText('4')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Sanctions')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('Full AML')).toBeInTheDocument();
    expect(listOrganizations).toHaveBeenCalledWith({ search: '', page: 1, limit: 20 });
  });

  it('shows an empty state', async () => {
    listOrganizations.mockResolvedValue(response([]));
    renderPage();

    expect(await screen.findByTestId('organizations-empty')).toHaveTextContent('No organizations yet.');
  });

  it('searches by name after debounce', async () => {
    renderPage();
    await screen.findAllByTestId('organization-row');

    fireEvent.change(screen.getByTestId('organizations-search'), { target: { value: 'Test' } });

    await waitFor(() => {
      expect(listOrganizations).toHaveBeenLastCalledWith({ search: 'Test', page: 1, limit: 20 });
    });
  });

  it('requests the selected page', async () => {
    listOrganizations.mockResolvedValue(response(ORGS, { total: 45, totalPages: 3 }));
    renderPage();
    await screen.findAllByTestId('organization-row');

    fireEvent.click(screen.getByTestId('pagination-page-2'));

    await waitFor(() => {
      expect(listOrganizations).toHaveBeenLastCalledWith({ search: '', page: 2, limit: 20 });
    });
  });

  it('navigates to details on row click', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('organization-row');

    fireEvent.click(rows[1]);

    expect(mockNavigate).toHaveBeenCalledWith('/superadmin/organizations/org2');
  });

  it('navigates to the registration form', async () => {
    renderPage();
    await screen.findAllByTestId('organization-row');

    fireEvent.click(screen.getByTestId('new-organization-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/superadmin/organizations/new');
  });

  it('shows a toast when loading fails', async () => {
    listOrganizations.mockRejectedValue({ response: { data: { error: 'Server error' } } });
    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
    expect(screen.getByTestId('organizations-empty')).toBeInTheDocument();
  });
});
