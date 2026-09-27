import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SuperAdminOrganizationDetailsPage from '../pages/SuperAdminOrganizationDetailsPage';

vi.mock('../services/organizationService', () => ({
  getOrganization: vi.fn(),
  updateOrganizationServices: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { getOrganization, updateOrganizationServices } from '../services/organizationService';
import { toast } from 'react-toastify';

const ORG = {
  id: 'org1',
  name: 'TestCorporation',
  country: 'Polska',
  city: 'Gdańsk',
  address: 'Grunwaldzka 223',
  createdAt: '2026-01-15T10:00:00Z',
  services: { sanctions: true, identityMode: 'NONE' },
  userCount: 4,
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/superadmin/organizations/org1']}>
      <Routes>
        <Route path="/superadmin/organizations/:id" element={<SuperAdminOrganizationDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );

const waitForLoaded = () => screen.findByTestId('organization-name');

describe('SuperAdminOrganizationDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrganization.mockResolvedValue(ORG);
  });

  it('loads and shows organization details with current services', async () => {
    renderPage();
    await waitForLoaded();

    expect(getOrganization).toHaveBeenCalledWith('org1');
    expect(screen.getByTestId('organization-name')).toHaveTextContent('TestCorporation');
    expect(screen.getByText('Grunwaldzka 223, Gdańsk, Polska')).toBeInTheDocument();
    expect(screen.getByTestId('organization-user-count')).toHaveTextContent('4');
    expect(screen.getByLabelText('Sanctions screening')).toBeChecked();
    expect(screen.getByLabelText('None')).toBeChecked();
    expect(screen.getByTestId('propagation-notice')).toHaveTextContent(
      'Changes apply to signed-in users within 15 minutes and to API clients within 1 minute.'
    );
  });

  it('enables Save only after a change', async () => {
    renderPage();
    await waitForLoaded();

    expect(screen.getByTestId('save-services-btn')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Identity verification'));

    expect(screen.getByTestId('save-services-btn')).toBeEnabled();
  });

  it('blocks Save and shows a message when no service is selected', async () => {
    renderPage();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText('Sanctions screening'));

    expect(screen.getByTestId('services-none-warning')).toHaveTextContent('At least one service must be enabled');
    expect(screen.getByTestId('save-services-btn')).toBeDisabled();
  });

  it('saves after confirmation in the modal and shows a toast', async () => {
    const updated = { ...ORG, services: { sanctions: false, identityMode: 'IDENTITY' } };
    updateOrganizationServices.mockResolvedValue(updated);
    renderPage();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText('Sanctions screening'));
    fireEvent.click(screen.getByLabelText('Identity verification'));
    fireEvent.click(screen.getByTestId('save-services-btn'));

    expect(await screen.findByTestId('confirm-services-modal')).toBeInTheDocument();
    expect(updateOrganizationServices).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-services-btn'));

    await waitFor(() => {
      expect(updateOrganizationServices).toHaveBeenCalledWith('org1', { sanctions: false, identityMode: 'IDENTITY' });
      expect(toast.success).toHaveBeenCalledWith('Organization services updated');
    });
    await waitFor(() => expect(screen.getByTestId('save-services-btn')).toBeDisabled());
  });

  it('does not save when the modal is cancelled', async () => {
    renderPage();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText('Identity verification'));
    fireEvent.click(screen.getByTestId('save-services-btn'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(updateOrganizationServices).not.toHaveBeenCalled();
  });

  it('shows an error toast when saving fails', async () => {
    updateOrganizationServices.mockRejectedValue({ response: { data: { error: 'At least one service must be enabled' } } });
    renderPage();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText('Identity verification'));
    fireEvent.click(screen.getByTestId('save-services-btn'));
    fireEvent.click(await screen.findByTestId('confirm-services-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('At least one service must be enabled');
    });
    // Unsaved selection is kept so the user can retry
    expect(screen.getByLabelText('Identity verification')).toBeChecked();
  });

  it('shows a not found message for an unknown organization', async () => {
    getOrganization.mockRejectedValue({ response: { status: 404, data: { error: 'Organization not found' } } });
    renderPage();

    expect(await screen.findByTestId('organization-load-error')).toHaveTextContent('Organization not found.');
    expect(screen.getByTestId('back-to-organizations')).toHaveAttribute('href', '/superadmin');
  });
});
