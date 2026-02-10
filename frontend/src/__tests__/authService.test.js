import { describe, it, expect, beforeEach, vi } from 'vitest';
import authService from '../services/authService';
import api from '../services/api';

// Mock api module
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  }
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    it('should save accessToken and user to localStorage (no refreshToken)', async () => {
      const mockResponse = {
        data: {
          accessToken: 'test-access-token',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'admin',
            firstName: 'John',
            lastName: 'Doe'
          }
        }
      };

      api.post.mockResolvedValue(mockResponse);

      const result = await authService.login('test@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      });

      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-access-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.data.user));
      // refreshToken should NOT be stored in localStorage
      expect(localStorage.setItem).not.toHaveBeenCalledWith('refreshToken', expect.anything());
      expect(result).toEqual(mockResponse.data);
    });

    it('should not save to localStorage if accessToken is missing', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful but no token'
        }
      };

      api.post.mockResolvedValue(mockResponse);

      await authService.login('test@example.com', 'password123');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should throw error on failed login', async () => {
      const error = new Error('Invalid credentials');
      api.post.mockRejectedValue(error);

      await expect(authService.login('test@example.com', 'wrong-password'))
        .rejects.toThrow('Invalid credentials');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should call logout API (no body) and clear localStorage', async () => {
      api.post.mockResolvedValue({ data: { message: 'Logged out' } });

      await authService.logout();

      // Should call without refreshToken in body (cookie sent automatically)
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should clear localStorage even if API call fails', async () => {
      api.post.mockRejectedValue(new Error('Network error'));

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('silentRefresh', () => {
    it('should return token data on successful refresh', async () => {
      const mockResponse = {
        data: { accessToken: 'new-access-token' }
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await authService.silentRefresh();

      expect(api.post).toHaveBeenCalledWith('/auth/refresh');
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-access-token');
      expect(result).toEqual(mockResponse.data);
    });

    it('should return null on failed refresh', async () => {
      api.post.mockRejectedValue(new Error('Unauthorized'));

      const result = await authService.silentRefresh();

      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return parsed user from localStorage', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin'
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.getItem.mockReturnValue(JSON.stringify(mockUser));

      const user = authService.getCurrentUser();

      expect(localStorage.getItem).toHaveBeenCalledWith('user');
      expect(user).toEqual(mockUser);
    });

    it('should return null when no user in localStorage', () => {
      localStorage.getItem.mockReturnValue(null);

      const user = authService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should return null when JSON parsing fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.getItem.mockReturnValue('invalid-json{]');

      const user = authService.getCurrentUser();

      expect(user).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
