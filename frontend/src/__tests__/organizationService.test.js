import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { listOrganizations, getOrganization, updateOrganizationServices } from '../services/organizationService';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { ok: true } });
    api.put.mockResolvedValue({ data: { ok: true } });
  });

  it('lists organizations with search and pagination params', async () => {
    const result = await listOrganizations({ search: 'Acme', page: 2, limit: 20 });

    expect(api.get).toHaveBeenCalledWith('/auth/organizations', { params: { search: 'Acme', page: 2, limit: 20 } });
    expect(result).toEqual({ ok: true });
  });

  it('omits empty params', async () => {
    await listOrganizations({ search: '', page: undefined });

    expect(api.get).toHaveBeenCalledWith('/auth/organizations', { params: {} });
  });

  it('gets organization details', async () => {
    await getOrganization('64b000000000000000000001');

    expect(api.get).toHaveBeenCalledWith('/auth/organizations/64b000000000000000000001');
  });

  it('replaces services with a PUT containing only the service fields', async () => {
    await updateOrganizationServices('org1', { sanctions: false, identityMode: 'IDENTITY', extra: 'x' });

    expect(api.put).toHaveBeenCalledWith('/auth/organizations/org1/services', {
      sanctions: false,
      identityMode: 'IDENTITY',
    });
  });
});
