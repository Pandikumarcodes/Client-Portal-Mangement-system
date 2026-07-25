import { describe, expect, it, vi } from 'vitest';

import {
  createTenantProject,
  getTenantProject,
  listTenantProjects,
  updateTenantProject,
} from '../../../src/modules/projects/project.service.js';

const record = {
  _id: 'project-id',
  tenantId: 'tenant-id',
  clientId: 'client-id',
  name: 'Portal redesign',
  description: undefined,
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  __v: 4,
  internal: 'not-public',
};
const expectedDto = {
  id: 'project-id',
  clientId: 'client-id',
  name: 'Portal redesign',
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('Project service', () => {
  it('verifies the tenant-scoped Client before creating and returns a safe frozen DTO', async () => {
    const order = [];
    const findClientById = vi.fn(async () => {
      order.push('client');
      return { _id: 'client-id' };
    });
    const createProject = vi.fn(async () => {
      order.push('project');
      return record;
    });

    const result = await createTenantProject(
      {
        tenantId: 'tenant-id',
        clientId: 'client-id',
        name: 'Portal redesign',
        description: undefined,
      },
      { findClientById, createProject },
    );

    expect(order).toEqual(['client', 'project']);
    expect(findClientById).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      clientId: 'client-id',
    });
    expect(createProject).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      clientId: 'client-id',
      name: 'Portal redesign',
      description: undefined,
    });
    expect(result).toEqual(expectedDto);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('__v');
    expect(result).not.toHaveProperty('internal');
  });

  it('makes missing and cross-tenant Clients indistinguishable and skips creation', async () => {
    const createProject = vi.fn();
    await expect(
      createTenantProject(
        { tenantId: 'tenant-id', clientId: 'other-client', name: 'Project' },
        { findClientById: vi.fn().mockResolvedValue(null), createProject },
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CLIENT_NOT_FOUND',
      message: 'The client was not found.',
    });
    expect(createProject).not.toHaveBeenCalled();
  });

  it('lists safe DTOs with tenant scope and frozen pagination', async () => {
    const findProjects = vi.fn().mockResolvedValue({ projects: [record], total: 5 });
    const result = await listTenantProjects(
      {
        tenantId: 'tenant-id',
        page: 2,
        limit: 2,
        status: 'active',
        clientId: 'client-id',
      },
      { findProjects },
    );
    expect(findProjects).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      page: 2,
      limit: 2,
      status: 'active',
      clientId: 'client-id',
    });
    expect(result).toEqual({
      projects: [expectedDto],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.projects)).toBe(true);
    expect(Object.isFrozen(result.pagination)).toBe(true);
    expect(result.projects[0]).not.toHaveProperty('tenantId');
  });

  it('returns zero totalPages for an empty listing', async () => {
    await expect(
      listTenantProjects(
        { tenantId: 'tenant-id', page: 1, limit: 20 },
        { findProjects: vi.fn().mockResolvedValue({ projects: [], total: 0 }) },
      ),
    ).resolves.toMatchObject({
      projects: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  it('gets a tenant-scoped safe Project and translates a missing record', async () => {
    const findProjectById = vi.fn().mockResolvedValue(record);
    await expect(
      getTenantProject({ tenantId: 'tenant-id', projectId: 'project-id' }, { findProjectById }),
    ).resolves.toEqual(expectedDto);
    expect(findProjectById).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      projectId: 'project-id',
    });

    await expect(
      getTenantProject(
        { tenantId: 'tenant-id', projectId: 'missing' },
        { findProjectById: vi.fn().mockResolvedValue(null) },
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
      message: 'The project was not found.',
    });
  });

  it('tenant-verifies replacement Client and passes only safe updates', async () => {
    const findClientById = vi.fn().mockResolvedValue({ _id: 'replacement-client' });
    const updateProjectById = vi.fn().mockResolvedValue({
      ...record,
      clientId: 'replacement-client',
      description: undefined,
    });
    await updateTenantProject(
      {
        tenantId: 'tenant-id',
        projectId: 'project-id',
        updates: {
          clientId: 'replacement-client',
          description: null,
          status: 'archived',
          tenantId: 'attacker-tenant',
          progress: 100,
        },
      },
      { findClientById, updateProjectById },
    );
    expect(findClientById).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      clientId: 'replacement-client',
    });
    expect(updateProjectById).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      projectId: 'project-id',
      updates: {
        clientId: 'replacement-client',
        description: undefined,
        status: 'archived',
      },
    });
  });

  it('does not update when the replacement Client is missing', async () => {
    const updateProjectById = vi.fn();
    await expect(
      updateTenantProject(
        {
          tenantId: 'tenant-id',
          projectId: 'project-id',
          updates: { clientId: 'missing-client' },
        },
        { findClientById: vi.fn().mockResolvedValue(null), updateProjectById },
      ),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    expect(updateProjectById).not.toHaveBeenCalled();
  });

  it('translates a missing update target and rethrows unexpected errors unchanged', async () => {
    await expect(
      updateTenantProject(
        {
          tenantId: 'tenant-id',
          projectId: 'missing',
          updates: { name: 'Updated' },
        },
        { updateProjectById: vi.fn().mockResolvedValue(null) },
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });

    const failure = new Error('repository failure');
    await expect(
      getTenantProject(
        { tenantId: 'tenant-id', projectId: 'project-id' },
        { findProjectById: vi.fn().mockRejectedValue(failure) },
      ),
    ).rejects.toBe(failure);
  });

  it('requires trusted tenant context, never mutates records, and performs no logging', async () => {
    const snapshot = { ...record };
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      getTenantProject({ tenantId: '', projectId: 'project-id' }, { findProjectById: vi.fn() }),
    ).rejects.toBeInstanceOf(TypeError);
    await getTenantProject(
      { tenantId: 'tenant-id', projectId: 'project-id' },
      { findProjectById: vi.fn().mockResolvedValue(record) },
    );
    expect(record).toEqual(snapshot);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
