import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import api, { getHistory } from '../services/api';

describe('getHistory — URL construction', () => {
  let getSpy;

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [], meta: {} } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds base URL with no params', async () => {
    await getHistory();
    expect(getSpy).toHaveBeenCalledWith('/sanctions/history');
  });

  it('appends page and limit', async () => {
    await getHistory({ page: 2, limit: 5 });
    const url = getSpy.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
  });

  it('appends search term', async () => {
    await getHistory({ search: 'Putin' });
    expect(getSpy.mock.calls[0][0]).toContain('search=Putin');
  });

  it('appends hasHit=true (boolean)', async () => {
    await getHistory({ hasHit: true });
    expect(getSpy.mock.calls[0][0]).toContain('hasHit=true');
  });

  it('appends hasHit=false (boolean)', async () => {
    await getHistory({ hasHit: false });
    expect(getSpy.mock.calls[0][0]).toContain('hasHit=false');
  });

  it('appends hasHit=true (string)', async () => {
    await getHistory({ hasHit: 'true' });
    expect(getSpy.mock.calls[0][0]).toContain('hasHit=true');
  });

  it('omits hasHit when undefined', async () => {
    await getHistory({ page: 1 });
    expect(getSpy.mock.calls[0][0]).not.toContain('hasHit');
  });

  it('omits empty string params', async () => {
    await getHistory({ search: '', startDate: '' });
    const url = getSpy.mock.calls[0][0];
    expect(url).not.toContain('search=');
    expect(url).not.toContain('startDate=');
  });

  it('appends date range params', async () => {
    await getHistory({ startDate: '2024-01-01', endDate: '2024-12-31T23:59:59' });
    const url = getSpy.mock.calls[0][0];
    expect(url).toContain('startDate=2024-01-01');
    expect(url).toContain('endDate=');
  });

  it('combines all params correctly', async () => {
    await getHistory({ page: 1, limit: 10, search: 'Test', hasHit: true });
    const url = getSpy.mock.calls[0][0];
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('search=Test');
    expect(url).toContain('hasHit=true');
  });

  it('returns response data', async () => {
    getSpy.mockResolvedValue({ data: { data: [{ id: 1 }], meta: { totalItems: 1 } } });
    const result = await getHistory({ page: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);
  });
});
