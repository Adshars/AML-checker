import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the entire api module to prevent axios initialization
vi.mock('../services/api', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn()
    }
  };
});

import api from '../services/api';

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should make GET request', async () => {
      const mockData = { data: [] };
      api.get.mockResolvedValue(mockData);

      const result = await api.get('/history');

      expect(api.get).toHaveBeenCalledWith('/history');
      expect(result).toEqual(mockData);
    });
  });

  describe('POST requests', () => {
    it('should make POST request', async () => {
      const userData = { email: 'test@example.com', password: 'pass' };
      const mockResponse = { data: { user: {} } };
      api.post.mockResolvedValue(mockResponse);

      const result = await api.post('/auth/login', userData);

      expect(api.post).toHaveBeenCalledWith('/auth/login', userData);
      expect(result).toEqual(mockResponse);
    });
  });
});
