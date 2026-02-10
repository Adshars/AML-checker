import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useSanctionsCheck from '../hooks/useSanctionsCheck';
import coreService from '../services/coreService';

vi.mock('../services/coreService', () => ({
  default: { checkEntity: vi.fn() },
}));

describe('useSanctionsCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with idle state', () => {
    const { result } = renderHook(() => useSanctionsCheck());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.results).toBeNull();
  });

  it('sets error for empty name', async () => {
    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('   '));

    expect(result.current.error).toBe('Name field is required.');
    expect(coreService.checkEntity).not.toHaveBeenCalled();
  });

  it('calls coreService and normalizes CLEAN response', async () => {
    coreService.checkEntity.mockResolvedValue({ result: 'CLEAN', data: [] });

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('John Doe'));

    expect(coreService.checkEntity).toHaveBeenCalledWith({ name: 'John Doe', fuzzy: true, limit: 10 });
    expect(result.current.results).toEqual({ matchStatus: 'CLEAN', entities: [] });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls coreService and normalizes HIT response', async () => {
    coreService.checkEntity.mockResolvedValue({
      result: 'HIT',
      data: [{
        id: '1',
        properties: { name: ['Vladimir Putin'], topics: ['sanction'] },
        score: 0.95,
        country: ['RU'],
      }],
    });

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('Putin'));

    expect(result.current.results.matchStatus).toBe('HIT');
    expect(result.current.results.entities).toHaveLength(1);
    expect(result.current.results.entities[0].isSanctioned).toBe(true);
    expect(result.current.results.entities[0].name).toBe('Vladimir Putin');
  });

  it('handles API error', async () => {
    coreService.checkEntity.mockRejectedValue({
      response: { data: { message: 'Service unavailable' } },
    });

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('Test'));

    expect(result.current.error).toBe('Service unavailable');
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('handles network error without response', async () => {
    coreService.checkEntity.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('Test'));

    expect(result.current.error).toBe('Network error');
  });

  it('trims input before calling service', async () => {
    coreService.checkEntity.mockResolvedValue({ result: 'CLEAN', data: [] });

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('  John Doe  '));

    expect(coreService.checkEntity).toHaveBeenCalledWith({ name: 'John Doe', fuzzy: true, limit: 10 });
  });

  it('clearResults resets state', async () => {
    coreService.checkEntity.mockResolvedValue({ result: 'CLEAN', data: [] });

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('Test'));
    expect(result.current.results).not.toBeNull();

    act(() => result.current.clearResults());
    expect(result.current.results).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('clears previous error on new check', async () => {
    coreService.checkEntity.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useSanctionsCheck());

    await act(() => result.current.checkEntity('Test'));
    expect(result.current.error).toBe('fail');

    coreService.checkEntity.mockResolvedValueOnce({ result: 'CLEAN', data: [] });

    await act(() => result.current.checkEntity('Test'));
    expect(result.current.error).toBeNull();
  });
});
