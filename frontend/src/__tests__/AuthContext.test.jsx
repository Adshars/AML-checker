import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import authService from '../services/authService';
import { useContext } from 'react';

// Mock authService
vi.mock('../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    silentRefresh: vi.fn(),
  }
}));

// Test component to access context
const TestComponent = () => {
  const { user, login, logout, loading } = useContext(AuthContext);

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Ready'}</div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.location;
    window.location = { href: '' };
  });

  it('should initialize with user after successful silent refresh', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin'
    };

    authService.getCurrentUser.mockReturnValue(mockUser);
    authService.silentRefresh.mockResolvedValue({ accessToken: 'new-token' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    expect(authService.getCurrentUser).toHaveBeenCalled();
    expect(authService.silentRefresh).toHaveBeenCalled();
  });

  it('should clear user when silent refresh fails (expired session)', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin'
    };

    authService.getCurrentUser.mockReturnValue(mockUser);
    authService.silentRefresh.mockResolvedValue(null); // Session expired

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    });

    // User should be cleared since silent refresh failed
    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('should initialize with no user when localStorage is empty', async () => {
    authService.getCurrentUser.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    // Should NOT attempt silent refresh when no cached user
    expect(authService.silentRefresh).not.toHaveBeenCalled();
  });

  it('should update user state on login', async () => {
    authService.getCurrentUser.mockReturnValue(null);
    authService.login.mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'logged-in@example.com',
        role: 'user'
      },
      accessToken: 'token'
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    });

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in@example.com');
    });

    expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('should clear user state on logout and redirect', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin'
    };

    authService.getCurrentUser.mockReturnValue(mockUser);
    authService.silentRefresh.mockResolvedValue({ accessToken: 'token' });
    authService.logout.mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalled();
      expect(window.location.href).toBe('/login');
    });
  });

  it('should show loading state during initialization', async () => {
    authService.getCurrentUser.mockReturnValue(null);

    const { container } = render(
      <AuthProvider>
        <div>Content</div>
      </AuthProvider>
    );

    // After mount, loading should complete and children should render
    await waitFor(() => {
      expect(container.textContent).toBe('Content');
    });
  });
});
