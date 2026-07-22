import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/api', () => ({
  confirmPasswordReset: vi.fn(),
  default: {},
}));

import { confirmPasswordReset } from '../services/api';

const renderPage = (search = '?token=tok123&id=user123') =>
  render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPasswordPage />
    </MemoryRouter>
  );

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error alert when token/id are missing from the URL', () => {
    renderPage('');
    expect(screen.getByRole('alert')).toHaveTextContent(/missing or invalid/i);
  });

  it('renders New Password and Confirm Password fields', () => {
    renderPage();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('shows a client-side error when passwords do not match', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText('New Password'), 'Password1!');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'Different2!');
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    });
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('submits the new password and shows a success message', async () => {
    confirmPasswordReset.mockResolvedValue({ message: 'ok' });
    renderPage();

    await userEvent.type(screen.getByLabelText('New Password'), 'Password1!');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'Password1!');
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith({
        userId: 'user123',
        token: 'tok123',
        newPassword: 'Password1!',
      });
      expect(screen.getByRole('alert')).toHaveTextContent(/redirecting to login/i);
    });
  });

  it('shows the server-side error message on failure', async () => {
    confirmPasswordReset.mockRejectedValue({ response: { data: { error: 'Token expired' } } });
    renderPage();

    await userEvent.type(screen.getByLabelText('New Password'), 'Password1!');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'Password1!');
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Token expired');
    });
  });

  it('toggles New Password visibility independently from Confirm Password', () => {
    renderPage();
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    expect(newPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    const newPasswordGroup = newPasswordInput.closest('.input-group');
    fireEvent.click(within(newPasswordGroup).getByRole('button', { name: /show password/i }));

    expect(newPasswordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(within(newPasswordGroup).getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
