import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../src/core/errors/api-error.js';
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
        userId: 'client-user-id',
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

const { createProjectRouter } = await import('../../../src/modules/projects/project.routes.js');

const clientId = 'abcdefabcdef123456789012';
const projectId = '1234567890abcdef12345678';
const project = {
  id: projectId,
  clientId,
  name: 'Portal redesign',
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createTestApp = () => {
  const services = {
    createTenantProject: vi.fn().mockResolvedValue(project),
    listTenantProjects: vi.fn().mockResolvedValue({
      projects: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    getTenantProject: vi.fn().mockResolvedValue(project),
    updateTenantProject: vi.fn(async ({ updates }) => ({ ...project, ...updates })),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/projects', createProjectRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, services };
};

describe('Project routes', () => {
  let testApp;

  beforeEach(() => {
    testApp = createTestApp();
    tokenMocks.verifyAccessToken.mockClear();
  });

  it('requires authentication before Project validation', async () => {
    const response = await request(testApp.app).post('/api/v1/projects').send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(testApp.services.createTenantProject).not.toHaveBeenCalled();
  });

  it.each([
    ['client-token', 'Client'],
    ['super-admin-token', 'Super Admin'],
  ])('forbids %s access for the %s role', async (token) => {
    const response = await request(testApp.app).get('/api/v1/projects').set(auth(token));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(testApp.services.listTenantProjects).not.toHaveBeenCalled();
  });

  it('allows an Organization Admin to create a Project with validated input', async () => {
    const response = await request(testApp.app)
      .post('/api/v1/projects')
      .set(auth('organization-admin-token'))
      .send({ clientId, name: '  Portal redesign  ', description: '   ' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { project } });
    expect(testApp.services.createTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      clientId,
      name: 'Portal redesign',
      description: undefined,
    });
  });

  it('rejects invalid and tenant-bearing create bodies safely', async () => {
    const invalid = await request(testApp.app)
      .post('/api/v1/projects')
      .set(auth('organization-admin-token'))
      .send({ clientId: 'private-invalid-id', name: 'x' });
    const tenant = await request(testApp.app)
      .post('/api/v1/projects')
      .set(auth('organization-admin-token'))
      .send({ clientId, name: 'Valid project', tenantId: 'private-tenant-id' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(invalid.body)).not.toContain('private-invalid-id');
    expect(tenant.status).toBe(400);
    expect(tenant.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists Projects with default pagination from validated query', async () => {
    const response = await request(testApp.app)
      .get('/api/v1/projects')
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    expect(testApp.services.listTenantProjects).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      page: 1,
      limit: 20,
      status: undefined,
      clientId: undefined,
    });
  });

  it('gets a Project using normalized validated params', async () => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId.toUpperCase()}`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(200);
    expect(response.body.data.project).toEqual(project);
    expect(testApp.services.getTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
    });
  });

  it('rejects an invalid Project ID without exposing it', async () => {
    const response = await request(testApp.app)
      .get('/api/v1/projects/private-invalid-project-id')
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private-invalid-project-id');
  });

  it('returns PROJECT_NOT_FOUND from the service unchanged', async () => {
    testApp.services.getTenantProject.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'The project was not found.',
      }),
    );
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'PROJECT_NOT_FOUND',
      message: 'The project was not found.',
    });
  });

  it.each(['on_hold', 'completed', 'archived'])('updates Project status to %s', async (status) => {
    const response = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth('organization-admin-token'))
      .send({ status });
    expect(response.status).toBe(200);
    expect(response.body.data.project.status).toBe(status);
    expect(testApp.services.updateTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      updates: { status },
    });
  });

  it('rejects an empty update', async () => {
    const response = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth('organization-admin-token'))
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(testApp.services.updateTenantProject).not.toHaveBeenCalled();
  });

  it('does not register DELETE or milestone routes', async () => {
    const deletion = await request(testApp.app)
      .delete(`/api/v1/projects/${projectId}`)
      .set(auth('organization-admin-token'));
    const milestones = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/milestones`)
      .set(auth('organization-admin-token'));
    expect(deletion.status).toBe(404);
    expect(deletion.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(milestones.status).toBe(404);
    expect(milestones.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('never exposes tenant IDs or access tokens in error responses', async () => {
    const response = await request(testApp.app)
      .post('/api/v1/projects')
      .set(auth('organization-admin-token'))
      .send({ tenantId: 'private-tenant', accessToken: 'private-access-token' });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('trusted-tenant-id');
    expect(serialized).not.toContain('private-tenant');
    expect(serialized).not.toContain('organization-admin-token');
    expect(serialized).not.toContain('private-access-token');
  });
});
