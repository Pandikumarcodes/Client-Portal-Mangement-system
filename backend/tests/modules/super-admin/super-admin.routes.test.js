import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAccessToken = vi.hoisted(() => vi.fn());
vi.mock('../../../src/modules/auth/token.js', () => ({ verifyAccessToken }));

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';
import { createSuperAdminRouter } from '../../../src/modules/super-admin/super-admin.routes.js';

const id = 'abcdefabcdefabcdefabcdef';

const services = {
  getSuperAdminOverview: vi.fn(),
  listOrganizations: vi.fn(),
  getOrganizationDetails: vi.fn(),
  updateOrganizationStatus: vi.fn(),
  listOrganizationUsers: vi.fn(),
};

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/super-admin', createSuperAdminRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const authorized = (requestBuilder, role = 'super_admin') => {
  verifyAccessToken.mockReturnValue({
    userId: 'user-id',
    role,
    tokenType: 'access',
    ...(role === 'super_admin' ? {} : { tenantId: id }),
  });
  return requestBuilder.set('Authorization', 'Bearer offline-token');
};

beforeEach(() => {
  vi.clearAllMocks();
  services.getSuperAdminOverview.mockResolvedValue({
    organizations: { total: 0, active: 0, suspended: 0 },
    users: { total: 0, organizationAdmins: 0, clients: 0 },
  });
  services.listOrganizations.mockResolvedValue({
    organizations: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  services.getOrganizationDetails.mockResolvedValue({ id });
  services.updateOrganizationStatus.mockResolvedValue({ id, status: 'suspended' });
  services.listOrganizationUsers.mockResolvedValue({
    users: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

describe('Super Admin routes', () => {
  it('requires authentication and the Super Admin role', async () => {
    const app = createApp();
    const unauthenticated = await request(app).get('/api/v1/super-admin/overview');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    for (const role of ['organization_admin', 'client']) {
      const forbidden = await authorized(request(app).get('/api/v1/super-admin/overview'), role);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('serves overview, Organization list, detail, status, and users', async () => {
    const app = createApp();
    expect((await authorized(request(app).get('/api/v1/super-admin/overview'))).status).toBe(200);
    expect(
      (await authorized(request(app).get('/api/v1/super-admin/organizations?status=active')))
        .status,
    ).toBe(200);
    expect(
      (await authorized(request(app).get(`/api/v1/super-admin/organizations/${id}`))).status,
    ).toBe(200);
    expect(
      (
        await authorized(
          request(app)
            .patch(`/api/v1/super-admin/organizations/${id}/status`)
            .send({ status: 'suspended' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await authorized(
          request(app).get(`/api/v1/super-admin/organizations/${id}/users?role=client`),
        )
      ).status,
    ).toBe(200);
  });

  it('rejects invalid IDs, statuses, Super Admin user filters, and unknown fields', async () => {
    const app = createApp();
    const invalidId = await authorized(
      request(app).get('/api/v1/super-admin/organizations/not-an-id'),
    );
    expect(invalidId.body.error.code).toBe('VALIDATION_ERROR');
    const invalidStatus = await authorized(
      request(app)
        .patch(`/api/v1/super-admin/organizations/${id}/status`)
        .send({ status: 'deleted' }),
    );
    expect(invalidStatus.body.error.code).toBe('VALIDATION_ERROR');
    const invalidRole = await authorized(
      request(app).get(`/api/v1/super-admin/organizations/${id}/users?role=super_admin`),
    );
    expect(invalidRole.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['post', '/api/v1/super-admin/organizations'],
    ['delete', `/api/v1/super-admin/organizations/${id}`],
    ['post', `/api/v1/super-admin/organizations/${id}/users`],
    ['post', `/api/v1/super-admin/organizations/${id}/impersonate`],
    ['get', `/api/v1/super-admin/organizations/${id}/clients`],
    ['get', `/api/v1/super-admin/organizations/${id}/projects`],
  ])('does not register %s %s', async (method, path) => {
    const response = await authorized(request(createApp())[method](path));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});
