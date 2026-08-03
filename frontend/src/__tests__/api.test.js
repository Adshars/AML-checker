import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import api, { getHistory, exportHistory } from '../services/api';

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

describe('exportHistory', () => {
  let getSpy;
  const csvBlob = new Blob(['a;b'], { type: 'text/csv' });

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: csvBlob,
      headers: { 'content-disposition': 'attachment; filename="aml-history-2026-07-31.csv"' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds base URL with no params', async () => {
    await exportHistory();
    expect(getSpy.mock.calls[0][0]).toBe('/sanctions/history/export');
  });

  it('requests a blob response', async () => {
    await exportHistory();
    expect(getSpy.mock.calls[0][1]).toEqual({ responseType: 'blob' });
  });

  it('appends filters but never page/limit', async () => {
    await exportHistory({ page: 3, limit: 10, search: 'Putin', hasHit: true, startDate: '2026-07-01', endDate: '2026-07-31' });
    const url = getSpy.mock.calls[0][0];
    expect(url).toContain('search=Putin');
    expect(url).toContain('hasHit=true');
    expect(url).toContain('startDate=2026-07-01');
    expect(url).toContain('endDate=2026-07-31');
    expect(url).not.toContain('page=');
    expect(url).not.toContain('limit=');
  });

  it('resolves with the blob and filename parsed from Content-Disposition', async () => {
    const result = await exportHistory();
    expect(result.blob).toBe(csvBlob);
    expect(result.filename).toBe('aml-history-2026-07-31.csv');
  });

  it('falls back to a default filename when Content-Disposition is missing', async () => {
    getSpy.mockResolvedValue({ data: csvBlob, headers: {} });
    const result = await exportHistory();
    expect(result.filename).toBe('aml-history-export.csv');
  });
});
