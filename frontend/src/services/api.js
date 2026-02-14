import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Variables for handling token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Automatic inclusion of token in headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle session expiration (401) with Silent Refresh Token
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and not a retry attempt (prevents loops)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {

      // Skip refresh for auth endpoints themselves
      if (originalRequest.url.includes('/auth/refresh') || originalRequest.url.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // If refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
        .then((token) => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call backend for new token (cookie carries refreshToken automatically)
        // Use clean axios instance to bypass this interceptor
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });

        if (response.status === 200 && response.data.accessToken) {
          const { accessToken } = response.data;

          // Save new access token
          localStorage.setItem('token', accessToken);

          // Update API instance headers and original request
          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;

          // Process queued requests
          processQueue(null, accessToken);
          isRefreshing = false;

          // Retry original request
          return api(originalRequest);
        }
      } catch (err) {
        // If refresh failed, log out
        processQueue(err, null);
        isRefreshing = false;

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(err);
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

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} response data with stats
 */
export const getDashboardStats = () => {
  return api.get('/sanctions/stats').then((response) => response.data);
};

/**
 * Register a new organization (SuperAdmin only)
 * @param {Object} data - Organization registration data
 * @returns {Promise<Object>} response data with organization and admin user
 */
export const registerOrganization = (data) => {
  return api.post('/auth/register-organization', data).then((response) => response.data);
};

export default api;
