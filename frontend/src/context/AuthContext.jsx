import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on app startup
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  /**
   * Login function - wrapper on authService.login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} Response data
   */
  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
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
