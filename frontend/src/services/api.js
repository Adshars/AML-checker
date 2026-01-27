import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios Interceptors

// Request Interceptor: Automatic inclusion of token in headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // We get the token from the browser's local storage
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handling session expiration (401)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // If the server returns 401 (Unauthorized), it means the token has expired
    if (error.response && error.response.status === 401) {
      // Avoid loops (do not log out if the error concerns the login itself)
      if (!error.config.url.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Reloading the page will force a return to the login screen (we will handle this in AuthContext)
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch audit history with query params
 * @param {Object} params - e.g. { page, limit, search, startDate, endDate, hasHit }
 * @returns {Promise<Object>} response data
 */
export const getHistory = (params = {}) => {
  const searchParams = new URLSearchParams();

  const entries = {
    page: params.page,
    limit: params.limit,
    search: params.search,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });

  if (params.hasHit === true || params.hasHit === false || params.hasHit === 'true' || params.hasHit === 'false') {
    searchParams.append('hasHit', String(params.hasHit));
  }

  const query = searchParams.toString();
  const url = query ? `/sanctions/history?${query}` : '/sanctions/history';

  return api.get(url).then((response) => response.data);
};

/**
 * Users Management API Methods (Admin Only)
 */

/**
 * Get all users in the organization
 * @returns {Promise<Object>} response data with users array
 */
export const getUsers = () => {
  return api.get('/users').then((response) => response.data);
};

/**
 * Create a new user in the organization
 * @param {Object} userData - { email, password, firstName, lastName, role? }
 * @returns {Promise<Object>} response data with created user
 */
export const createUser = (userData) => {
  return api.post('/users', userData).then((response) => response.data);
};

/**
 * Delete a user from the organization
 * @param {string} userId - User ID to delete
 * @returns {Promise<Object>} response data
 */
export const deleteUser = (userId) => {
  return api.delete(`/users/${userId}`).then((response) => response.data);
};

/**
 * Change password for the authenticated user
 * @param {{ currentPassword: string, newPassword: string }} data
 * @returns {Promise<Object>} response data
 */
export const changePassword = (data) => {
  return api.post('/auth/change-password', data).then((response) => response.data);
};

/**
 * Get organization's public API key
 */
export const getOrganizationKeys = () => {
  return api.get('/auth/organization/keys').then((response) => response.data);
};

/**
 * Reset organization's API secret (requires password confirmation)
 */
export const resetOrganizationSecret = (password) => {
  return api.post('/auth/reset-secret', { password }).then((response) => response.data);
};

/**
 * Request password reset link
 * @param {string} email
 * @returns {Promise<Object>} response data
 */
export const requestPasswordReset = (email) => {
  return api.post('/auth/forgot-password', { email }).then((response) => response.data);
};

/**
 * Confirm password reset with token
 * @param {{ userId: string, token: string, newPassword: string }} data
 * @returns {Promise<Object>} response data
 */
export const confirmPasswordReset = (data) => {
  return api.post('/auth/reset-password', data).then((response) => response.data);
};

export default api;