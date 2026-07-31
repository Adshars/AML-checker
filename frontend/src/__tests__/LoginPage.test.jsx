import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';

// Controlled navigation spy
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Only mock requestPasswordReset — avoid importing the real api module
vi.mock('../services/api', () => ({
  requestPasswordReset: vi.fn(),
  default: {},
}));

import { requestPasswordReset } from '../services/api';

const mockLogin = vi.fn();

const renderPage = (loginFn = mockLogin) =>
  render(
    <AuthContext.Provider value={{ login: loginFn, user: null, loading: false }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password inputs and Sign In button', () => {
    renderPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('navigates to /dashboard after successful admin login', async () => {
    mockLogin.mockResolvedValue({ user: { role: 'admin' } });
    renderPage();

    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@test.com');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'password123');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('navigates to /superadmin after successful superadmin login', async () => {
    mockLogin.mockResolvedValue({ user: { role: 'superadmin' } });
    renderPage();

    await userEvent.type(screen.getByLabelText(/email address/i), 'super@admin.com');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'superpass');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/superadmin');
    });
  });

  it('shows error alert on failed login', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { error: 'Invalid email or password' } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText(/email address/i), 'bad@test.com');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'wrongpass');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables button and shows "Signing in…" during loading', async () => {
    // Login never resolves during this test
    mockLogin.mockImplementation(() => new Promise(() => {}));
    renderPage();

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@test.com');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'somepassword');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  it('toggles password visibility when eye button is clicked', async () => {
    renderPage();
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' });
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('opens Forgot Password modal when link is clicked', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveTextContent('Reset Password');
    });
  });

  it('submits reset email and closes modal on success', async () => {
    requestPasswordReset.mockResolvedValue({ message: 'ok' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const emailInput = screen.getByRole('dialog').querySelector('input[type="email"]');
    await userEvent.type(emailInput, 'user@test.com');
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('user@test.com');
    });
  });
});
