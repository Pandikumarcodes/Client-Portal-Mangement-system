import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';

const tokenMocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn((token) => {
    const identities = {
      'organization-admin-token': {
        userId: 'admin-id',
        role: 'organization_admin',
        tenantId: 'trusted-tenant-id',
        tokenType: 'access',
      },
      'client-token': {
        userId: 'client-id',
        role: 'client',
        tenantId: 'trusted-tenant-id',
        tokenType: 'access',
      },
      'super-admin-token': {
        userId: 'super-id',
        role: 'super_admin',
        tokenType: 'access',
      },
    };
    return identities[token] ?? null;
  }),
}));

vi.mock('../../../src/modules/auth/token.js', () => ({
  verifyAccessToken: tokenMocks.verifyAccessToken,
}));

const { createDashboardRouter } =
  await import('../../../src/modules/dashboard/dashboard.routes.js');

const dashboard = Object.freeze({
  clients: Object.freeze({ total: 1, active: 1, inactive: 0 }),
  projects: Object.freeze({ total: 0, active: 0, onHold: 0, completed: 0, archived: 0 }),
  milestones: Object.freeze({ total: 0, pending: 0, inProgress: 0, completed: 0 }),
  files: Object.freeze({ total: 0, active: 0, archived: 0 }),
  invoices: Object.freeze({ total: 0, draft: 0, sent: 0, paid: 0, void: 0 }),
});
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createTestApp = () => {
  const services = {
    getOrganizationDashboard: vi.fn().mockResolvedValue(dashboard),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/dashboard', createDashboardRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, services };
};

let testApp;

beforeEach(() => {
  vi.clearAllMocks();
  testApp = createTestApp();
});

describe('dashboard routes', () => {
  it('requires authentication for the Organization dashboard', async () => {
    const response = await request(testApp.app).get('/api/v1/dashboard/organization');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(testApp.services.getOrganizationDashboard).not.toHaveBeenCalled();
  });

  it.each(['client-token', 'super-admin-token'])(
    'forbids the %s role from the Organization dashboard',
    async (token) => {
      const response = await request(testApp.app)
        .get('/api/v1/dashboard/organization')
        .set(auth(token));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(testApp.services.getOrganizationDashboard).not.toHaveBeenCalled();
    },
  );

  it('allows an Organization Admin and uses only authenticated tenant context', async () => {
    const response = await request(testApp.app)
      .get('/api/v1/dashboard/organization?tenantId=untrusted&from=2020-01-01&to=2030-01-01')
      .set(auth('organization-admin-token'))
      .send({ tenantId: 'body-tenant-id' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { dashboard } });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(testApp.services.getOrganizationDashboard).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('on_hold');
    expect(serialized).not.toContain('in_progress');
  });

  it.each(['post', 'patch', 'delete'])('does not register %s /organization', async (method) => {
    const client = request(testApp.app);
    const response = await client[method]('/api/v1/dashboard/organization')
      .set(auth('organization-admin-token'))
      .send({ tenantId: 'private-tenant', token: 'private-token' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('private-tenant');
    expect(serialized).not.toContain('private-token');
    expect(serialized).not.toContain('organization-admin-token');
  });

  it('does not register the deferred Client dashboard', async () => {
    const response = await request(testApp.app)
      .get('/api/v1/dashboard/client')
      .set(auth('client-token'));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('forwards service failures through the centralized safe error handler', async () => {
    testApp.services.getOrganizationDashboard.mockRejectedValue(
      new Error('private tenant-id token failure'),
    );

    const response = await request(testApp.app)
      .get('/api/v1/dashboard/organization')
      .set(auth('organization-admin-token'));

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('tenant-id');
    expect(serialized).not.toContain('token');
  });
});
