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

export default api;