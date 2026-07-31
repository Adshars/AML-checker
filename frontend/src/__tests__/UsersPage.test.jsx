import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from '../pages/UsersPage';

vi.mock('../hooks/useUsers', () => ({
  default: vi.fn(),
}));

import useUsers from '../hooks/useUsers';

const baseUsers = [
  { id: '1', firstName: 'Jan', lastName: 'Kowalski', email: 'jan@acme.com', role: 'admin', createdAt: '2026-01-15T00:00:00.000Z' },
  { id: '2', firstName: 'Anna', lastName: 'Nowak', email: 'anna@acme.com', role: 'user', createdAt: '2026-02-20T00:00:00.000Z' },
];

const mockAddUser = vi.fn();
const mockRemoveUser = vi.fn();
const mockClearMessages = vi.fn();

const setHook = (overrides = {}) => {
  useUsers.mockReturnValue({
    users: baseUsers,
    loading: false,
    error: null,
    success: null,
    addUser: mockAddUser,
    removeUser: mockRemoveUser,
    clearMessages: mockClearMessages,
    setError: vi.fn(),
    setSuccess: vi.fn(),
    ...overrides,
  });
};

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHook();
  });

  it('renders a row for each user with a role badge', () => {
    render(<UsersPage />);
    expect(screen.getAllByTestId('user-row')).toHaveLength(2);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    setHook({ loading: true, users: [] });
    render(<UsersPage />);
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });

  it('shows an empty state message when there are no users', () => {
    setHook({ users: [] });
    render(<UsersPage />);
    expect(screen.getByText(/no users found in your organization/i)).toBeInTheDocument();
  });

  it('shows a client-side validation error for a short password', async () => {
    render(<UsersPage />);
    fireEvent.click(screen.getByTestId('add-user-btn'));

    await userEvent.type(screen.getByLabelText('First Name'), 'Jan');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Kowalski');
    await userEvent.type(screen.getByLabelText('Email'), 'jan@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    fireEvent.click(screen.getByTestId('save-user-btn'));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockAddUser).not.toHaveBeenCalled();
  });

  it('submits a valid new user and closes the modal on success', async () => {
    mockAddUser.mockResolvedValue(true);
    render(<UsersPage />);
    fireEvent.click(screen.getByTestId('add-user-btn'));

    await userEvent.type(screen.getByLabelText('First Name'), 'Jan');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Kowalski');
    await userEvent.type(screen.getByLabelText('Email'), 'JAN@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    fireEvent.click(screen.getByTestId('save-user-btn'));

    await waitFor(() => {
      expect(mockAddUser).toHaveBeenCalledWith({
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan@acme.com',
        password: 'password123',
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('add-user-modal')).not.toBeInTheDocument();
    });
  });

  it('opens the delete confirmation modal and calls removeUser on confirm', async () => {
    mockRemoveUser.mockResolvedValue(true);
    render(<UsersPage />);

    fireEvent.click(screen.getAllByTestId('delete-user-btn')[0]);
    const modal = screen.getByTestId('confirm-delete-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('jan@acme.com')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockRemoveUser).toHaveBeenCalledWith(baseUsers[0]);
    });
  });

  it('toggles password visibility when the eye button is clicked', async () => {
    render(<UsersPage />);
    fireEvent.click(screen.getByTestId('add-user-btn'));

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
