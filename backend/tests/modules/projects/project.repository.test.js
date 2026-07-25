import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Project: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../src/modules/projects/project.model.js', () => ({ Project: mocks.Project }));

const { createProject, findProjectById, findProjects, updateProjectById } =
  await import('../../../src/modules/projects/project.repository.js');

const record = { _id: 'project-id' };
const queryWithLean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Project repository', () => {
  it('creates one tenant-owned Project without supplying status', async () => {
    mocks.Project.create.mockResolvedValue(record);
    await expect(
      createProject({
        tenantId: 'tenant-id',
        clientId: 'client-id',
        name: 'Project',
        description: undefined,
      }),
    ).resolves.toBe(record);
    expect(mocks.Project.create).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      clientId: 'client-id',
      name: 'Project',
      description: undefined,
    });
    expect(mocks.Project.create.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('lists and counts with the same tenant/status/client filter and pagination', async () => {
    const lean = vi.fn().mockResolvedValue([record]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.Project.find.mockReturnValue({ sort });
    mocks.Project.countDocuments.mockResolvedValue(6);

    await expect(
      findProjects({
        tenantId: 'tenant-id',
        page: 3,
        limit: 2,
        status: 'active',
        clientId: 'client-id',
      }),
    ).resolves.toEqual({ projects: [record], total: 6 });

    const expectedFilter = {
      tenantId: 'tenant-id',
      status: 'active',
      clientId: 'client-id',
    };
    expect(mocks.Project.find).toHaveBeenCalledWith(expectedFilter);
    expect(mocks.Project.countDocuments).toHaveBeenCalledWith(expectedFilter);
    expect(mocks.Project.find.mock.calls[0][0]).toBe(mocks.Project.countDocuments.mock.calls[0][0]);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(4);
    expect(limit).toHaveBeenCalledWith(2);
    expect(lean).toHaveBeenCalledOnce();
  });

  it('uses only tenant scope when optional listing filters are absent', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.Project.find.mockReturnValue({ sort });
    mocks.Project.countDocuments.mockResolvedValue(0);

    await findProjects({ tenantId: 'tenant-id', page: 1, limit: 20 });
    expect(mocks.Project.find).toHaveBeenCalledWith({ tenantId: 'tenant-id' });
    expect(mocks.Project.countDocuments).toHaveBeenCalledWith({ tenantId: 'tenant-id' });
  });

  it('finds by both _id and tenantId and returns null unchanged', async () => {
    mocks.Project.findOne.mockReturnValue(queryWithLean(null));
    await expect(
      findProjectById({ tenantId: 'tenant-id', projectId: 'project-id' }),
    ).resolves.toBeNull();
    expect(mocks.Project.findOne).toHaveBeenCalledWith({
      _id: 'project-id',
      tenantId: 'tenant-id',
    });
  });

  it('updates by tenant scope with validators/new result and a strict field allowlist', async () => {
    mocks.Project.findOneAndUpdate.mockReturnValue(queryWithLean(record));
    await expect(
      updateProjectById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        updates: {
          clientId: 'replacement-client',
          name: 'Updated',
          description: undefined,
          status: 'archived',
          tenantId: 'attacker-tenant',
          budget: 10,
        },
      }),
    ).resolves.toBe(record);
    expect(mocks.Project.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'project-id', tenantId: 'tenant-id' },
      {
        clientId: 'replacement-client',
        name: 'Updated',
        description: undefined,
        status: 'archived',
      },
      { new: true, runValidators: true },
    );
  });

  it('returns a missing update result and never connects to MongoDB', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    mocks.Project.findOneAndUpdate.mockReturnValue(queryWithLean(null));
    await expect(
      updateProjectById({
        tenantId: 'tenant-id',
        projectId: 'missing',
        updates: { name: 'Updated' },
      }),
    ).resolves.toBeNull();
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
