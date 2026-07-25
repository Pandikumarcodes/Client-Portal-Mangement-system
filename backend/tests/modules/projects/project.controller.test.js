import { describe, expect, it, vi } from 'vitest';

import { createProjectController } from '../../../src/modules/projects/project.controller.js';

const project = {
  id: 'project-id',
  clientId: 'client-id',
  name: 'Portal redesign',
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
const createResponse = () => {
  const response = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
};
const createDependencies = () => ({
  createTenantProject: vi.fn().mockResolvedValue(project),
  listTenantProjects: vi.fn().mockResolvedValue({ projects: [project], pagination }),
  getTenantProject: vi.fn().mockResolvedValue(project),
  updateTenantProject: vi.fn().mockResolvedValue(project),
});

describe('Project controller', () => {
  it('returns a frozen controller with exactly four handlers', () => {
    const controller = createProjectController(createDependencies());
    expect(Object.isFrozen(controller)).toBe(true);
    expect(Object.keys(controller)).toEqual(['create', 'list', 'getById', 'update']);
    expect(Object.values(controller).every((handler) => typeof handler === 'function')).toBe(true);
  });

  it('creates from trusted auth tenant and validated body, ignoring raw body tenantId', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    await createProjectController(dependencies).create(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: {
          body: {
            clientId: 'client-id',
            name: 'Portal redesign',
            description: undefined,
          },
        },
        body: { tenantId: 'attacker-tenant', name: 'Raw name' },
      },
      response,
    );
    expect(dependencies.createTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      clientId: 'client-id',
      name: 'Portal redesign',
      description: undefined,
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: { project },
    });
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('data.project.tenantId');
  });

  it('lists from validated query with an explicit response envelope', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    const query = { page: 1, limit: 20, status: 'active', clientId: 'client-id' };
    await createProjectController(dependencies).list(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: { query },
        query: { tenantId: 'attacker-tenant' },
      },
      response,
    );
    expect(dependencies.listTenantProjects).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      ...query,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: { projects: [project], pagination },
    });
  });

  it('gets using validated params and returns HTTP 200', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    await createProjectController(dependencies).getById(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: { params: { projectId: 'project-id' } },
        params: { projectId: 'raw-id' },
      },
      response,
    );
    expect(dependencies.getTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('updates using validated params/body and returns a safe success envelope', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    const body = { status: 'archived' };
    await createProjectController(dependencies).update(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: { params: { projectId: 'project-id' }, body },
        body: { tenantId: 'attacker-tenant' },
      },
      response,
    );
    expect(dependencies.updateTenantProject).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      updates: body,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json.mock.calls[0][0]).toEqual({
      success: true,
      data: { project },
    });
  });

  it('propagates service errors without model or logging access', async () => {
    const failure = new Error('service failure');
    const dependencies = createDependencies();
    dependencies.getTenantProject.mockRejectedValue(failure);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      createProjectController(dependencies).getById(
        {
          auth: { tenantId: 'tenant-id' },
          validated: { params: { projectId: 'project-id' } },
        },
        createResponse(),
      ),
    ).rejects.toBe(failure);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
