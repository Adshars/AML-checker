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

    // Save access token and user to localStorage
    // (refreshToken is now set as HttpOnly cookie by the backend)
    if (response.data.accessToken) {
      localStorage.setItem('token', response.data.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  },

  /**
   * Logout - Clear session (cookie cleared by backend)
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      // Cookie is sent automatically with withCredentials: true
      await api.post('/auth/logout');
    } catch (error) {
      // Network error should not prevent logout
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear localStorage regardless of API success or failure
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  /**
   * Silent refresh - attempt to get a new access token using the HttpOnly cookie
   * @returns {Promise<Object|null>} New access token data or null if session expired
   */
  silentRefresh: async () => {
    try {
      const response = await api.post('/auth/refresh');

      if (response.data.accessToken) {
        localStorage.setItem('token', response.data.accessToken);
        return response.data;
      }
      return null;
    } catch {
      return null;
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
