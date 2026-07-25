import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import * as superAdminApi from './super-admin-api.js';

beforeEach(() => {
  apiRequest.mockReset();
});

describe('Super Admin API', () => {
  it('loads the overview and forwards AbortSignal', async () => {
    const signal = new AbortController().signal;
    apiRequest.mockResolvedValue({ success: true, data: { overview: { organizations: {} } } });
    await expect(
      superAdminApi.getSuperAdminOverview({ signal }, 'token'),
    ).resolves.toEqual({ organizations: {} });
    expect(apiRequest).toHaveBeenCalledWith('/super-admin/overview', {
      method: 'GET',
      accessToken: 'token',
      signal,
    });
  });

  it('lists Organizations with pagination and a supplied status filter', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { organizations: [], pagination: { page: 2 } },
    });
    await superAdminApi.listOrganizations(
      { page: 2, limit: 20, status: 'suspended' },
      'token',
    );
    expect(apiRequest.mock.calls[0][0]).toBe(
      '/super-admin/organizations?page=2&limit=20&status=suspended',
    );
  });

  it('omits blank Organization filters and never sends tenantId', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { organizations: [], pagination: {} },
    });
    await superAdminApi.listOrganizations(
      { page: 1, limit: 20, status: '', tenantId: 'hidden' },
      'token',
    );
    expect(apiRequest.mock.calls[0][0]).toBe('/super-admin/organizations?page=1&limit=20');
    expect(JSON.stringify(apiRequest.mock.calls)).not.toContain('hidden');
  });

  it('loads Organization details and updates only status with PATCH', async () => {
    apiRequest
      .mockResolvedValueOnce({ success: true, data: { organization: { id: 'org/1' } } })
      .mockResolvedValueOnce({
        success: true,
        data: { organization: { id: 'org/1', status: 'suspended' } },
      });
    await superAdminApi.getOrganization('org/1', 'token');
    await superAdminApi.updateOrganizationStatus('org/1', 'suspended', 'token');
    expect(apiRequest.mock.calls[0][0]).toBe('/super-admin/organizations/org%2F1');
    expect(apiRequest.mock.calls[1]).toEqual([
      '/super-admin/organizations/org%2F1/status',
      {
        accessToken: 'token',
        method: 'PATCH',
        body: { status: 'suspended' },
      },
    ]);
  });

  it('lists nested users with supported role/status filters and no tenantId', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { users: [], pagination: {} },
    });
    await superAdminApi.listOrganizationUsers({
      organizationId: 'org',
      page: 2,
      limit: 20,
      role: 'client',
      status: 'active',
      tenantId: 'hidden',
    }, 'token');
    expect(apiRequest.mock.calls[0][0]).toBe(
      '/super-admin/organizations/org/users?page=2&limit=20&role=client&status=active',
    );
    expect(JSON.stringify(apiRequest.mock.calls)).not.toContain('hidden');
  });

  it('fails safely for malformed envelopes and propagates request errors', async () => {
    apiRequest.mockResolvedValue({ success: true, data: {} });
    await expect(superAdminApi.getSuperAdminOverview({}, 'token')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    const failure = { code: 'FORBIDDEN' };
    apiRequest.mockRejectedValue(failure);
    await expect(superAdminApi.getSuperAdminOverview({}, 'token')).rejects.toBe(failure);
  });

  it('exports no create, delete, or impersonation functions', () => {
    expect(superAdminApi).not.toHaveProperty('createOrganization');
    expect(superAdminApi).not.toHaveProperty('deleteOrganization');
    expect(superAdminApi).not.toHaveProperty('createUser');
    expect(superAdminApi).not.toHaveProperty('impersonate');
  });
});
