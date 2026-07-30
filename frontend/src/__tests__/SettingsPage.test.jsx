import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../pages/SettingsPage';

vi.mock('../services/api', () => ({
  changePassword: vi.fn(),
  default: {},
}));

import { changePassword } from '../services/api';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the three password fields and the submit button', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password', { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();
  });

  it('shows a client-side error when the new passwords do not match', async () => {
    render(<SettingsPage />);
    await userEvent.type(screen.getByLabelText('Current Password'), 'CurrentPass1!');
    await userEvent.type(screen.getByLabelText('New Password', { exact: true }), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('Confirm New Password'), 'DifferentPass2!');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(screen.getByTestId('settings-error-alert')).toHaveTextContent('do not match');
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('submits the password change and shows a success message', async () => {
    changePassword.mockResolvedValue({ message: 'Password updated successfully' });
    render(<SettingsPage />);
    await userEvent.type(screen.getByLabelText('Current Password'), 'CurrentPass1!');
    await userEvent.type(screen.getByLabelText('New Password', { exact: true }), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentPass1!',
        newPassword: 'NewPass1!',
      });
      expect(screen.getByTestId('settings-success-alert')).toHaveTextContent('Password updated successfully');
    });
  });

  it('shows the server-side error message on failure', async () => {
    changePassword.mockRejectedValue({ response: { data: { error: 'Current password is incorrect' } } });
    render(<SettingsPage />);
    await userEvent.type(screen.getByLabelText('Current Password'), 'WrongPass1!');
    await userEvent.type(screen.getByLabelText('New Password', { exact: true }), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(screen.getByTestId('settings-error-alert')).toHaveTextContent('Current password is incorrect');
    });
  });

  it('toggles each password field visibility independently', () => {
    render(<SettingsPage />);
    const currentInput = screen.getByLabelText('Current Password');
    const newInput = screen.getByLabelText('New Password', { exact: true });
    const confirmInput = screen.getByLabelText('Confirm New Password');
    expect(currentInput).toHaveAttribute('type', 'password');
    expect(newInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    const currentGroup = currentInput.closest('.input-group');
    fireEvent.click(within(currentGroup).getByRole('button', { name: /show password/i }));

    expect(currentInput).toHaveAttribute('type', 'text');
    expect(newInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(within(currentGroup).getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
