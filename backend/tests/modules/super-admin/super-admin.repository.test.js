import { beforeEach, describe, expect, it, vi } from 'vitest';

const models = vi.hoisted(() => ({
  Organization: {
    countDocuments: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  User: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
}));
vi.mock('../../../src/modules/organizations/organization.model.js', () => ({
  Organization: models.Organization,
}));
vi.mock('../../../src/modules/users/user.model.js', () => ({
  User: models.User,
}));

import {
  findOrganizationById,
  findOrganizations,
  findOrganizationUsers,
  getOrganizationUserCounts,
  getPlatformCounts,
  updateOrganizationStatusById,
} from '../../../src/modules/super-admin/super-admin.repository.js';

const query = (result) => {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Super Admin repository', () => {
  it('counts Organizations and only approved tenant-user roles efficiently', async () => {
    models.Organization.countDocuments
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    models.User.countDocuments.mockResolvedValueOnce(4).mockResolvedValueOnce(6);
    await expect(getPlatformCounts()).resolves.toEqual({
      organizations: { total: 3, statuses: { active: 2, suspended: 1 } },
      users: {
        total: 10,
        roles: { organization_admin: 4, client: 6 },
      },
    });
    expect(models.Organization.find).not.toHaveBeenCalled();
    expect(models.User.find).not.toHaveBeenCalled();
    expect(models.User.countDocuments).toHaveBeenNthCalledWith(1, {
      role: 'organization_admin',
    });
    expect(models.User.countDocuments).toHaveBeenNthCalledWith(2, { role: 'client' });
  });

  it('lists filtered Organizations newest first with matching count and pagination', async () => {
    const chain = query([{ _id: 'organization-id' }]);
    models.Organization.find.mockReturnValue(chain);
    models.Organization.countDocuments.mockResolvedValue(1);
    const result = await findOrganizations({
      page: 2,
      limit: 20,
      status: 'suspended',
    });
    expect(models.Organization.find).toHaveBeenCalledWith({ status: 'suspended' });
    expect(models.Organization.countDocuments).toHaveBeenCalledWith({ status: 'suspended' });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(20);
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(chain.select.mock.calls[0][0]).not.toContain('plan');
    expect(result.total).toBe(1);
  });

  it('treats legacy missing status as active in the active filter', async () => {
    models.Organization.find.mockReturnValue(query([]));
    models.Organization.countDocuments.mockResolvedValue(0);
    await findOrganizations({ page: 1, limit: 20, status: 'active' });
    expect(models.Organization.find).toHaveBeenCalledWith({
      status: { $ne: 'suspended' },
    });
  });

  it('looks up by _id and selects only safe fields', async () => {
    const chain = query(null);
    models.Organization.findOne.mockReturnValue(chain);
    await expect(findOrganizationById({ organizationId: 'organization-id' })).resolves.toBeNull();
    expect(models.Organization.findOne).toHaveBeenCalledWith({ _id: 'organization-id' });
    expect(chain.select.mock.calls[0][0]).toBe('_id name slug status createdAt updatedAt');
  });

  it('updates only status with validators and returns null when absent', async () => {
    const chain = query(null);
    models.Organization.findOneAndUpdate.mockReturnValue(chain);
    await expect(
      updateOrganizationStatusById({
        organizationId: 'organization-id',
        status: 'suspended',
      }),
    ).resolves.toBeNull();
    expect(models.Organization.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'organization-id' },
      { status: 'suspended' },
      { new: true, runValidators: true },
    );
  });

  it('counts and lists only tenant users with supported filters and safe projections', async () => {
    models.User.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await expect(getOrganizationUserCounts({ organizationId: 'organization-id' })).resolves.toEqual(
      {
        total: 3,
        roles: { organization_admin: 1, client: 2 },
      },
    );
    const chain = query([]);
    models.User.find.mockReturnValue(chain);
    models.User.countDocuments.mockResolvedValue(0);
    await findOrganizationUsers({
      organizationId: 'organization-id',
      page: 2,
      limit: 20,
      role: 'client',
      status: 'active',
    });
    const filter = {
      tenantId: 'organization-id',
      role: 'client',
      status: 'active',
    };
    expect(models.User.find).toHaveBeenCalledWith(filter);
    expect(models.User.countDocuments).toHaveBeenCalledWith(filter);
    expect(chain.select.mock.calls[0][0]).not.toContain('passwordHash');
    expect(chain.select.mock.calls[0][0]).not.toContain('refresh');
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.skip).toHaveBeenCalledWith(20);
  });

  it('excludes Super Admin by default and propagates repository failures', async () => {
    const failure = new Error('count failed');
    models.User.find.mockReturnValue(query([]));
    models.User.countDocuments.mockRejectedValueOnce(failure);
    await expect(
      findOrganizationUsers({
        organizationId: 'organization-id',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBe(failure);
    expect(models.User.find).toHaveBeenCalledWith({
      tenantId: 'organization-id',
      role: { $ne: 'super_admin' },
    });
  });
});
