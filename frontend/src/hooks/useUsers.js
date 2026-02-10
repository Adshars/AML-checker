import { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, deleteUser } from '../services/api';

/**
 * Custom hook for managing organization users.
 * Encapsulates fetching, creating, and deleting users.
 */
export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /**
   * Fetch all users from the organization.
   */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUsers();
      setUsers(response.data || []);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load users';
      if (err.response?.status === 403) {
        setError('Access denied: This page is for administrators only.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new user.
   */
  const addUser = async (userData) => {
    setError(null);
    try {
      await createUser(userData);
      setSuccess('User created successfully!');
      await fetchUsers();
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create user';
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Delete a user by ID.
   */
  const removeUser = async (user) => {
    setError(null);
    try {
      await deleteUser(user.id);
      setSuccess(`User ${user.email} deleted successfully!`);
      await fetchUsers();
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete user';
      
      if (err.response?.status === 400 && errorMessage.includes('own account')) {
        setError('You cannot delete your own account.');
      } else if (err.response?.status === 403) {
        setError('Access denied: You do not have permission to delete this user.');
      } else {
        setError(errorMessage);
      }
      return false;
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return {
    users,
    loading,
    error,
    success,
    fetchUsers,
    addUser,
    removeUser,
    clearMessages,
    setError,
    setSuccess
  };
}
