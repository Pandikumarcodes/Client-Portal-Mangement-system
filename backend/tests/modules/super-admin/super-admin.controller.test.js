import { describe, expect, it, vi } from 'vitest';

import { createSuperAdminController } from '../../../src/modules/super-admin/super-admin.controller.js';

const response = () => {
  const target = { status: vi.fn(), json: vi.fn() };
  target.status.mockReturnValue(target);
  target.json.mockReturnValue(target);
  return target;
};

describe('Super Admin controller', () => {
  it('is frozen and wraps overview in the success envelope', async () => {
    const overview = { organizations: {}, users: {} };
    const controller = createSuperAdminController({
      getSuperAdminOverview: vi.fn().mockResolvedValue(overview),
    });
    const target = response();
    await controller.overview({ body: { ignored: true } }, target);
    expect(Object.isFrozen(controller)).toBe(true);
    expect(target.status).toHaveBeenCalledWith(200);
    expect(target.json).toHaveBeenCalledWith({
      success: true,
      data: { overview },
    });
  });

  it('uses only validated list, detail, update, and user-list inputs', async () => {
    const services = {
      listOrganizations: vi.fn().mockResolvedValue({ organizations: [], pagination: {} }),
      getOrganizationDetails: vi.fn().mockResolvedValue({ id: 'organization-id' }),
      updateOrganizationStatus: vi.fn().mockResolvedValue({ id: 'organization-id' }),
      listOrganizationUsers: vi.fn().mockResolvedValue({ users: [], pagination: {} }),
    };
    const controller = createSuperAdminController(services);
    const raw = {
      params: { organizationId: 'raw' },
      query: { tenantId: 'raw' },
      body: { status: 'raw', passwordHash: 'hidden' },
      validated: {
        params: { organizationId: 'organization-id' },
        query: { page: 1, limit: 20 },
        body: { status: 'suspended' },
      },
    };
    await controller.listOrganizations(raw, response());
    await controller.getOrganization(raw, response());
    await controller.updateOrganizationStatus(raw, response());
    await controller.listOrganizationUsers(raw, response());
    expect(services.listOrganizations).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(services.getOrganizationDetails).toHaveBeenCalledWith({
      organizationId: 'organization-id',
    });
    expect(services.updateOrganizationStatus).toHaveBeenCalledWith({
      organizationId: 'organization-id',
      status: 'suspended',
    });
    expect(services.listOrganizationUsers).toHaveBeenCalledWith({
      organizationId: 'organization-id',
      page: 1,
      limit: 20,
    });
  });

  it('propagates service failures', async () => {
    const failure = new Error('failed');
    const controller = createSuperAdminController({
      getSuperAdminOverview: vi.fn().mockRejectedValue(failure),
    });
    await expect(controller.overview({}, response())).rejects.toBe(failure);
  });
});
