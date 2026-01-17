import api from './api';

const authService = {
  /**
   * Login - Authenticate user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} Response data with tokens
   */
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });

    // Save tokens and user to localStorage
    if (response.data.accessToken) {
      localStorage.setItem('token', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  },

  /**
   * Logout - Clear session and remove tokens from localStorage
   * @returns {Promise<void>}
   */
  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');

    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Network error should not prevent logout
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear localStorage regardless of API success or failure
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Get current user from localStorage
   * @returns {Object|null} User object or null if not logged in
   */
  getCurrentUser: () => {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson);
    } catch (error) {
      console.error('Failed to parse user from localStorage:', error);
      return null;
    }
  },
};

export default authService;
