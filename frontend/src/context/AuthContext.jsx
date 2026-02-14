import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
