import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import SuperAdminPage from '../pages/SuperAdminPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/api', () => ({
  registerOrganization: vi.fn(),
  default: {},
}));

import { registerOrganization } from '../services/api';

const mockLogout = vi.fn();

const validData = {
  orgName: 'ACME Corporation',
  country: 'US',
  city: 'New York',
  address: '123 Business Ave',
  firstName: 'John',
  lastName: 'Smith',
  email: 'admin@acme.com',
  password: 'password123',
};

const fillForm = async (overrides = {}) => {
  const data = { ...validData, ...overrides };
  await userEvent.type(screen.getByLabelText('Organization Name'), data.orgName);
  await userEvent.type(screen.getByLabelText('Country'), data.country);
  await userEvent.type(screen.getByLabelText('City'), data.city);
  await userEvent.type(screen.getByLabelText('Address'), data.address);
  await userEvent.type(screen.getByLabelText('First Name'), data.firstName);
  await userEvent.type(screen.getByLabelText('Last Name'), data.lastName);
  await userEvent.type(screen.getByLabelText('Email'), data.email);
  await userEvent.type(screen.getByLabelText('Password'), data.password);
};

const renderPage = () =>
  render(
    <AuthContext.Provider value={{ logout: mockLogout }}>
      <MemoryRouter>
        <SuperAdminPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('SuperAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the registration form fields', () => {
    renderPage();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register Organization' })).toBeInTheDocument();
  });

  it('shows a validation error for a password shorter than 8 characters', async () => {
    renderPage();
    await fillForm({ password: 'short' });
    fireEvent.click(screen.getByRole('button', { name: 'Register Organization' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(registerOrganization).not.toHaveBeenCalled();
  });

  it('submits valid data and shows a success message with the org name and email', async () => {
    registerOrganization.mockResolvedValue({
      organization: { name: 'ACME Corporation' },
      user: { email: 'admin@acme.com' },
    });
    renderPage();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register Organization' }));

    await waitFor(() => {
      expect(registerOrganization).toHaveBeenCalledWith(validData);
      expect(screen.getByRole('alert')).toHaveTextContent('ACME Corporation');
      expect(screen.getByRole('alert')).toHaveTextContent('admin@acme.com');
    });
  });

  it('shows the server-side error message on failure', async () => {
    registerOrganization.mockRejectedValue({ response: { data: { error: 'Email already registered' } } });
    renderPage();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register Organization' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
    });
  });

  it('calls logout and navigates to /login when Logout is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('toggles password visibility when the eye button is clicked', async () => {
    renderPage();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
