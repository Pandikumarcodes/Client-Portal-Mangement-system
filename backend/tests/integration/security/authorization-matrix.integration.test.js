import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';
import { createRequireActiveTenantContext } from '../../../src/modules/auth/auth.authorization.js';
import { createClientRouter } from '../../../src/modules/clients/client.routes.js';
import { createDashboardRouter } from '../../../src/modules/dashboard/dashboard.routes.js';
import { createInvoiceRouter } from '../../../src/modules/invoices/invoice.routes.js';
import { createProjectFileRouter } from '../../../src/modules/project-files/project-file.routes.js';
import { createProjectRouter } from '../../../src/modules/projects/project.routes.js';
import { createSuperAdminRouter } from '../../../src/modules/super-admin/super-admin.routes.js';
import { createAccessToken } from '../../../src/modules/auth/token.js';

const tenantId = '507f1f77bcf86cd799439011';
const projectId = '507f1f77bcf86cd799439012';
const tokens = {
  organizationAdmin: createAccessToken({
    userId: '507f1f77bcf86cd799439021',
    role: 'organization_admin',
    tenantId,
  }),
  client: createAccessToken({
    userId: '507f1f77bcf86cd799439022',
    role: 'client',
    tenantId,
  }),
  superAdmin: createAccessToken({
    userId: '507f1f77bcf86cd799439023',
    role: 'super_admin',
  }),
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
let organizationStatus;
let services;

const createTestApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.get('/api/v1/health', (_request, response) => response.status(200).json({ success: true }));
  app.post('/api/v1/auth/login', (_request, response) =>
    response.status(200).json({ success: true }),
  );

  const tenantContextMiddleware = createRequireActiveTenantContext({
    findOrganizationById: vi.fn(async () => ({ status: organizationStatus })),
  });
  services = {
    listTenantClients: vi.fn().mockResolvedValue({
      clients: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    listTenantProjects: vi.fn().mockResolvedValue({
      projects: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    listProjectFiles: vi.fn().mockResolvedValue({
      files: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    listProjectInvoices: vi.fn().mockResolvedValue({
      invoices: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    getOrganizationDashboard: vi.fn().mockResolvedValue({
      clients: { total: 0 },
      projects: { total: 0 },
      milestones: { total: 0 },
      files: { total: 0 },
      invoices: { total: 0 },
    }),
    getSuperAdminOverview: vi.fn().mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0 },
      users: { total: 0, organizationAdmins: 0, clients: 0 },
    }),
  };

  const tenantDependencies = { ...services, tenantContextMiddleware };
  app.use('/api/v1/clients', createClientRouter(tenantDependencies));
  app.use('/api/v1/projects', createProjectRouter(tenantDependencies));
  app.use('/api/v1/projects/:projectId/files', createProjectFileRouter(tenantDependencies));
  app.use('/api/v1/projects/:projectId/invoices', createInvoiceRouter(tenantDependencies));
  app.use('/api/v1/dashboard', createDashboardRouter(tenantDependencies));
  app.use('/api/v1/super-admin', createSuperAdminRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const roleCases = [
  ['unauthenticated', null],
  ['Organization Admin', tokens.organizationAdmin],
  ['Client', tokens.client],
  ['Super Admin', tokens.superAdmin],
];

describe('implemented backend route authorization matrix', () => {
  beforeEach(() => {
    organizationStatus = 'active';
  });

  it.each([
    ['/api/v1/clients', 'listTenantClients'],
    ['/api/v1/projects', 'listTenantProjects'],
    [`/api/v1/projects/${projectId}/files`, 'listProjectFiles'],
    [`/api/v1/projects/${projectId}/invoices`, 'listProjectInvoices'],
    ['/api/v1/dashboard/organization', 'getOrganizationDashboard'],
  ])('allows only Organization Admin for %s', async (path, serviceName) => {
    for (const [role, token] of roleCases) {
      const operation = request(createTestApp()).get(path);
      if (token) operation.set(bearer(token));
      const response = await operation;
      const expectedStatus =
        role === 'Organization Admin' ? 200 : role === 'unauthenticated' ? 401 : 403;
      expect(response.status, role).toBe(expectedStatus);
      expect(services[serviceName].mock.calls.length, role).toBe(
        role === 'Organization Admin' ? 1 : 0,
      );
    }
  });

  it('allows only Super Admin for the platform overview', async () => {
    for (const [role, token] of roleCases) {
      const operation = request(createTestApp()).get('/api/v1/super-admin/overview');
      if (token) operation.set(bearer(token));
      const response = await operation;
      const expectedStatus = role === 'Super Admin' ? 200 : role === 'unauthenticated' ? 401 : 403;
      expect(response.status, role).toBe(expectedStatus);
      expect(services.getSuperAdminOverview.mock.calls.length, role).toBe(
        role === 'Super Admin' ? 1 : 0,
      );
    }
  });

  it.each(roleCases)('keeps public and unknown route behavior for %s', async (_role, token) => {
    const app = createTestApp();
    for (const [method, path, status] of [
      ['get', '/api/v1/health', 200],
      ['post', '/api/v1/auth/login', 200],
      ['get', '/api/v1/unknown', 404],
      ['put', '/api/v1/health', 404],
    ]) {
      const operation = request(app)[method](path);
      if (token) operation.set(bearer(token));
      expect((await operation).status).toBe(status);
    }
  });

  it('blocks suspended tenants at request time and permits reactivation', async () => {
    organizationStatus = 'suspended';
    const suspended = await request(createTestApp())
      .get('/api/v1/clients')
      .set(bearer(tokens.organizationAdmin));
    expect(suspended.status).toBe(403);
    expect(suspended.body.error).toEqual({
      code: 'ORGANIZATION_SUSPENDED',
      message: 'The organization is suspended.',
    });
    expect(services.listTenantClients).not.toHaveBeenCalled();

    organizationStatus = 'active';
    const reactivated = await request(createTestApp())
      .get('/api/v1/clients')
      .set(bearer(tokens.organizationAdmin));
    expect(reactivated.status).toBe(200);

    organizationStatus = 'suspended';
    const platform = await request(createTestApp())
      .get('/api/v1/super-admin/overview')
      .set(bearer(tokens.superAdmin));
    expect(platform.status).toBe(200);
  });
});
