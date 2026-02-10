import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useUsers from '../hooks/useUsers';
import * as api from '../services/api';

// Mock the api service
vi.mock('../services/api', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
}));

describe('useUsers', () => {
  const mockUsers = [
    { id: '1', email: 'user1@test.com', firstName: 'User', lastName: 'One', role: 'user' },
    { id: '2', email: 'user2@test.com', firstName: 'User', lastName: 'Two', role: 'admin' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default mock response for getUsers
    api.getUsers.mockResolvedValue({ data: mockUsers });
  });

  it('fetches users on initialization', async () => {
    const { result } = renderHook(() => useUsers());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await act(async () => {
      // Wait for useEffect
    });

    expect(api.getUsers).toHaveBeenCalledTimes(1);
    expect(result.current.users).toEqual(mockUsers);
    expect(result.current.loading).toBe(false);
  });

  it('handles fetch error', async () => {
    api.getUsers.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useUsers());

    await act(async () => {});

    expect(result.current.error).toBe('Fetch failed');
    expect(result.current.users).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('handles 403 access denied on fetch', async () => {
    api.getUsers.mockRejectedValue({
      response: { status: 403, data: { error: 'Forbidden' } }
    });

    const { result } = renderHook(() => useUsers());

    await act(async () => {});

    expect(result.current.error).toContain('administrators only');
  });

  it('adds a user successfully', async () => {
    api.createUser.mockResolvedValue({ data: { id: '3', email: 'new@test.com' } });
    
    const { result } = renderHook(() => useUsers());
    await act(async () => {}); // initial fetch

    let success;
    await act(async () => {
      success = await result.current.addUser({ email: 'new@test.com' });
    });

    expect(success).toBe(true);
    expect(api.createUser).toHaveBeenCalledWith({ email: 'new@test.com' });
    expect(api.getUsers).toHaveBeenCalledTimes(2); // Initial + refresh after add
    expect(result.current.success).toBe('User created successfully!');
  });

  it('handles error when adding a user', async () => {
    api.createUser.mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useUsers());
    await act(async () => {});

    let success;
    await act(async () => {
      success = await result.current.addUser({ email: 'fail@test.com' });
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Create failed');
  });

  it('removes a user successfully', async () => {
    api.deleteUser.mockResolvedValue({});
    
    const { result } = renderHook(() => useUsers());
    await act(async () => {});

    let success;
    await act(async () => {
      success = await result.current.removeUser({ id: '1', email: 'user1@test.com' });
    });

    expect(success).toBe(true);
    expect(api.deleteUser).toHaveBeenCalledWith('1');
    expect(api.getUsers).toHaveBeenCalledTimes(2);
    expect(result.current.success).toContain('deleted successfully');
  });

  it('handles error when deleting a user', async () => {
    api.deleteUser.mockRejectedValue({
        response: { status: 400, data: { error: 'Cannot delete your own account' } }
    });

    const { result } = renderHook(() => useUsers());
    await act(async () => {});

    let success;
    await act(async () => {
      success = await result.current.removeUser({ id: 'me', email: 'me@test.com' });
    });

    expect(success).toBe(false);
    expect(result.current.error).toContain('cannot delete your own account');
  });

  it('clears messages', async () => {
    const { result } = renderHook(() => useUsers());
    
    await act(async () => {
        result.current.setSuccess('Done');
        result.current.setError('Fail');
    });

    expect(result.current.success).toBe('Done');
    expect(result.current.error).toBe('Fail');

    act(() => {
        result.current.clearMessages();
    });

    expect(result.current.success).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('auto-dismisses success message', async () => {
    const { result } = renderHook(() => useUsers());
    
    await act(async () => {
        result.current.setSuccess('Quick');
    });

    expect(result.current.success).toBe('Quick');

    act(() => {
        vi.advanceTimersByTime(5001);
    });

    expect(result.current.success).toBeNull();
  });
});
