import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ProjectFile: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../src/modules/project-files/project-file.model.js', () => ({
  ProjectFile: mocks.ProjectFile,
}));

const { createProjectFile, findProjectFileById, findProjectFiles, updateProjectFileById } =
  await import('../../../src/modules/project-files/project-file.repository.js');

const record = { _id: 'file-id' };
const queryWithLean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Project File repository', () => {
  it('creates trusted tenant- and Project-scoped metadata without status', async () => {
    mocks.ProjectFile.create.mockResolvedValue(record);
    const input = {
      tenantId: 'tenant-id',
      projectId: 'project-id',
      originalName: 'delivery.pdf',
      storedName: 'random.pdf',
      storagePath: 'random.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 123,
      description: undefined,
    };
    await expect(createProjectFile(input)).resolves.toBe(record);
    expect(mocks.ProjectFile.create).toHaveBeenCalledWith(input);
    expect(mocks.ProjectFile.create.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('lists and counts using one identical tenant/Project/status filter', async () => {
    const lean = vi.fn().mockResolvedValue([record]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.ProjectFile.find.mockReturnValue({ sort });
    mocks.ProjectFile.countDocuments.mockResolvedValue(5);

    await expect(
      findProjectFiles({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        page: 2,
        limit: 2,
        status: 'archived',
      }),
    ).resolves.toEqual({ files: [record], total: 5 });
    const filter = { tenantId: 'tenant-id', projectId: 'project-id', status: 'archived' };
    expect(mocks.ProjectFile.find).toHaveBeenCalledWith(filter);
    expect(mocks.ProjectFile.countDocuments).toHaveBeenCalledWith(filter);
    expect(mocks.ProjectFile.find.mock.calls[0][0]).toBe(
      mocks.ProjectFile.countDocuments.mock.calls[0][0],
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(2);
    expect(limit).toHaveBeenCalledWith(2);
    expect(lean).toHaveBeenCalledOnce();
  });

  it('always includes tenantId and projectId when optional status is absent', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.ProjectFile.find.mockReturnValue({ sort });
    mocks.ProjectFile.countDocuments.mockResolvedValue(0);
    await findProjectFiles({
      tenantId: 'tenant-id',
      projectId: 'project-id',
      page: 1,
      limit: 20,
    });
    expect(mocks.ProjectFile.find).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      projectId: 'project-id',
    });
  });

  it('finds one file only by _id, tenantId, and projectId', async () => {
    mocks.ProjectFile.findOne.mockReturnValue(queryWithLean(null));
    await expect(
      findProjectFileById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        fileId: 'file-id',
      }),
    ).resolves.toBeNull();
    expect(mocks.ProjectFile.findOne).toHaveBeenCalledWith({
      _id: 'file-id',
      tenantId: 'tenant-id',
      projectId: 'project-id',
    });
  });

  it('updates only description/status with tenant and Project scope', async () => {
    mocks.ProjectFile.findOneAndUpdate.mockReturnValue(queryWithLean(record));
    await expect(
      updateProjectFileById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        fileId: 'file-id',
        updates: {
          description: undefined,
          status: 'archived',
          tenantId: 'attacker',
          projectId: 'attacker-project',
          storedName: 'changed',
          storagePath: 'changed',
          mimeType: 'text/html',
          sizeBytes: 1,
          originalName: 'changed',
        },
      }),
    ).resolves.toBe(record);
    expect(mocks.ProjectFile.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'file-id', tenantId: 'tenant-id', projectId: 'project-id' },
      {
        $unset: { description: 1 },
        $set: { status: 'archived' },
      },
      { new: true, runValidators: true },
    );
  });

  it('returns null and never connects to MongoDB', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    mocks.ProjectFile.findOneAndUpdate.mockReturnValue(queryWithLean(null));
    await expect(
      updateProjectFileById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        fileId: 'missing',
        updates: { status: 'active' },
      }),
    ).resolves.toBeNull();
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
