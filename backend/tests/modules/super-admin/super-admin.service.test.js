import { describe, expect, it, vi } from 'vitest';

import {
  getOrganizationDetails,
  getSuperAdminOverview,
  listOrganizations,
  listOrganizationUsers,
  updateOrganizationStatus,
} from '../../../src/modules/super-admin/super-admin.service.js';

const organization = {
  _id: 'organization-id',
  name: 'Acme',
  slug: 'acme',
  status: 'active',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  plan: 'private-plan',
};
const user = {
  _id: 'user-id',
  tenantId: 'organization-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'organization_admin',
  status: 'active',
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
  passwordHash: 'hidden',
  refreshTokenHash: 'hidden',
};

describe('Super Admin service', () => {
  it('normalizes overview groups without adding business or percentage data', async () => {
    const result = await getSuperAdminOverview(
      {},
      {
        getPlatformCounts: vi.fn().mockResolvedValue({
          organizations: { total: 3, statuses: { active: 2, suspended: 1 } },
          users: {
            total: 8,
            roles: { organization_admin: 3, client: 5 },
            revenue: 100,
          },
        }),
      },
    );
    expect(result).toEqual({
      organizations: { total: 3, active: 2, suspended: 1 },
      users: { total: 8, organizationAdmins: 3, clients: 5 },
    });
    expect(result).not.toHaveProperty('revenue');
    expect(result).not.toHaveProperty('percentages');
  });

  it('turns absent and invalid overview counts into zero', async () => {
    const result = await getSuperAdminOverview(
      {},
      {
        getPlatformCounts: vi.fn().mockResolvedValue({
          organizations: { total: Number.NaN, statuses: { active: -1 } },
        }),
      },
    );
    expect(result).toEqual({
      organizations: { total: 0, active: 0, suspended: 0 },
      users: { total: 0, organizationAdmins: 0, clients: 0 },
    });
  });

  it('maps safe Organization list DTOs and pagination', async () => {
    const result = await listOrganizations(
      { page: 2, limit: 20 },
      {
        findOrganizations: vi.fn().mockResolvedValue({ organizations: [organization], total: 21 }),
      },
    );
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
    expect(result.organizations[0]).toEqual({
      id: 'organization-id',
      name: 'Acme',
      slug: 'acme',
      status: 'active',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    });
    expect(result.organizations[0]).not.toHaveProperty('plan');
  });

  it('returns safe details with only tenant-user counts', async () => {
    const result = await getOrganizationDetails(
      { organizationId: 'organization-id' },
      {
        findOrganizationById: vi.fn().mockResolvedValue(organization),
        getOrganizationUserCounts: vi.fn().mockResolvedValue({
          total: 4,
          roles: { organization_admin: 1, client: 3 },
        }),
      },
    );
    expect(result.userCounts).toEqual({ total: 4, organizationAdmins: 1, clients: 3 });
    expect(result).not.toHaveProperty('clients');
    expect(result).not.toHaveProperty('projects');
  });

  it('maps missing detail and update targets to ORGANIZATION_NOT_FOUND', async () => {
    await expect(
      getOrganizationDetails(
        { organizationId: 'missing' },
        {
          findOrganizationById: vi.fn().mockResolvedValue(null),
        },
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
    await expect(
      updateOrganizationStatus(
        { organizationId: 'missing', status: 'active' },
        {
          updateOrganizationStatusById: vi.fn().mockResolvedValue(null),
        },
      ),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_FOUND' });
  });

  it.each(['active', 'suspended'])('updates only the %s status input', async (status) => {
    const update = vi.fn().mockResolvedValue({ ...organization, status });
    const result = await updateOrganizationStatus(
      { organizationId: 'organization-id', status },
      { updateOrganizationStatusById: update },
    );
    expect(update).toHaveBeenCalledWith({ organizationId: 'organization-id', status });
    expect(result.status).toBe(status);
  });

  it('verifies the Organization and maps safe users while excluding Super Admin', async () => {
    const result = await listOrganizationUsers(
      { organizationId: 'organization-id', page: 1, limit: 20 },
      {
        findOrganizationById: vi.fn().mockResolvedValue(organization),
        findOrganizationUsers: vi.fn().mockResolvedValue({
          users: [user, { ...user, _id: 'super-id', role: 'super_admin' }],
          total: 1,
        }),
      },
    );
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).not.toHaveProperty('passwordHash');
    expect(result.users[0]).not.toHaveProperty('refreshTokenHash');
    expect(result.pagination.totalPages).toBe(1);
  });

  it('propagates unexpected failures unchanged', async () => {
    const failure = new Error('repository failed');
    await expect(
      getSuperAdminOverview(
        {},
        {
          getPlatformCounts: vi.fn().mockRejectedValue(failure),
        },
      ),
    ).rejects.toBe(failure);
  });
});
