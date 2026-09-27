import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { getServicesFromToken, TOKEN_UPDATED_EVENT } from '../utils/jwt';

export const AuthContext = createContext();

const readServices = () => getServicesFromToken(localStorage.getItem('token'));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState(readServices);
  const [loading, setLoading] = useState(true);

  // Organization services live in the access token; refresh them whenever it is replaced
  useEffect(() => {
    const handleTokenUpdated = () => setServices(readServices());
    window.addEventListener(TOKEN_UPDATED_EVENT, handleTokenUpdated);
    return () => window.removeEventListener(TOKEN_UPDATED_EVENT, handleTokenUpdated);
  }, []);

  // On app startup: try silent refresh to validate session via HttpOnly cookie
  useEffect(() => {
    const initAuth = async () => {
      const cachedUser = authService.getCurrentUser();

      if (!cachedUser) {
        // No cached user — no session to restore
        setLoading(false);
        return;
      }

      // Attempt silent refresh to verify the cookie is still valid
      const result = await authService.silentRefresh();

      if (result) {
        // Session valid — keep user
        setUser(cachedUser);
        setServices(getServicesFromToken(result.accessToken));
      } else {
        // Session expired — clear stale data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login function - wrapper on authService.login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} Response data
   */
  const login = async (email, password) => {
    const response = await authService.login(email, password);
    setUser(response.user);
    setServices(getServicesFromToken(response.accessToken));
    return response;
  };

  /**
   * Logout function - clears user state and calls authService.logout
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    services,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
