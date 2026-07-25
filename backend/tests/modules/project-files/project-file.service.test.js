import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectFile,
  listProjectFiles,
  prepareProjectFileDownload,
  updateProjectFile,
  uploadProjectFile,
} from '../../../src/modules/project-files/project-file.service.js';

const tenantId = 'tenant-id';
const projectId = 'project-id';
const fileId = 'file-id';
const record = {
  _id: fileId,
  tenantId,
  projectId,
  originalName: 'proposal.pdf',
  storedName: 'random.pdf',
  storagePath: 'random.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 123,
  description: undefined,
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const safeDto = {
  id: fileId,
  projectId,
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 123,
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

let dependencies;

beforeEach(() => {
  dependencies = {
    findProjectById: vi.fn().mockResolvedValue({ _id: projectId }),
    createProjectFile: vi.fn().mockResolvedValue(record),
    findProjectFiles: vi.fn().mockResolvedValue({ files: [record], total: 1 }),
    findProjectFileById: vi.fn().mockResolvedValue(record),
    updateProjectFileById: vi.fn().mockResolvedValue(record),
    persistUploadedFile: vi.fn().mockResolvedValue({
      storedName: 'random.pdf',
      storagePath: 'random.pdf',
      sizeBytes: 123,
    }),
    openStoredFile: vi.fn().mockResolvedValue(Readable.from('content')),
    removeStoredFile: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Project File service', () => {
  it('verifies Project first and uploads trusted metadata with a sanitized basename', async () => {
    const result = await uploadProjectFile(
      {
        tenantId,
        projectId,
        description: undefined,
        uploadedFile: {
          path: 'controlled-temp-path',
          originalname: '../../folder\\proposal.pdf',
          mimetype: 'application/pdf',
          size: 123,
        },
      },
      dependencies,
    );
    expect(dependencies.findProjectById).toHaveBeenCalledWith({ tenantId, projectId });
    expect(dependencies.persistUploadedFile).toHaveBeenCalledWith({
      temporaryPath: 'controlled-temp-path',
      mimeType: 'application/pdf',
    });
    expect(dependencies.createProjectFile).toHaveBeenCalledWith({
      tenantId,
      projectId,
      originalName: 'proposal.pdf',
      storedName: 'random.pdf',
      storagePath: 'random.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 123,
      description: undefined,
    });
    expect(result).toEqual(safeDto);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('storedName');
    expect(result).not.toHaveProperty('storagePath');
  });

  it('hides missing/cross-tenant Projects before storage or metadata access', async () => {
    dependencies.findProjectById.mockResolvedValue(null);
    await expect(
      uploadProjectFile(
        {
          tenantId,
          projectId,
          uploadedFile: {
            path: 'temp',
            originalname: 'file.pdf',
            mimetype: 'application/pdf',
            size: 1,
          },
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    expect(dependencies.persistUploadedFile).not.toHaveBeenCalled();
    expect(dependencies.createProjectFile).not.toHaveBeenCalled();
  });

  it('rejects missing, unsupported, empty, and oversized uploads safely', async () => {
    await expect(uploadProjectFile({ tenantId, projectId }, dependencies)).rejects.toMatchObject({
      code: 'PROJECT_FILE_REQUIRED',
    });
    await expect(
      uploadProjectFile(
        {
          tenantId,
          projectId,
          uploadedFile: {
            path: 'temp',
            originalname: 'page.html',
            mimetype: 'text/html',
            size: 1,
          },
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_TYPE_NOT_ALLOWED' });
    for (const size of [0, 10 * 1024 * 1024 + 1]) {
      await expect(
        uploadProjectFile(
          {
            tenantId,
            projectId,
            uploadedFile: {
              path: 'temp',
              originalname: 'file.pdf',
              mimetype: 'application/pdf',
              size,
            },
          },
          dependencies,
        ),
      ).rejects.toMatchObject({ code: 'PROJECT_FILE_TOO_LARGE' });
    }
  });

  it('rolls back persisted content without hiding metadata errors', async () => {
    const repositoryError = new Error('database failed');
    dependencies.createProjectFile.mockRejectedValue(repositoryError);
    dependencies.removeStoredFile.mockRejectedValue(new Error('rollback failed'));
    await expect(
      uploadProjectFile(
        {
          tenantId,
          projectId,
          uploadedFile: {
            path: 'temp',
            originalname: 'file.pdf',
            mimetype: 'application/pdf',
            size: 123,
          },
        },
        dependencies,
      ),
    ).rejects.toBe(repositoryError);
    expect(dependencies.removeStoredFile).toHaveBeenCalledWith({
      storagePath: 'random.pdf',
    });
  });

  it('verifies then lists tenant/Project-scoped safe DTOs', async () => {
    const result = await listProjectFiles(
      { tenantId, projectId, page: 1, limit: 20, status: 'active' },
      dependencies,
    );
    expect(dependencies.findProjectById.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.findProjectFiles.mock.invocationCallOrder[0],
    );
    expect(dependencies.findProjectFiles).toHaveBeenCalledWith({
      tenantId,
      projectId,
      page: 1,
      limit: 20,
      status: 'active',
    });
    expect(result.files).toEqual([safeDto]);
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.files)).toBe(true);
  });

  it('returns totalPages zero for an empty listing', async () => {
    dependencies.findProjectFiles.mockResolvedValue({ files: [], total: 0 });
    const result = await listProjectFiles(
      { tenantId, projectId, page: 1, limit: 20 },
      dependencies,
    );
    expect(result.pagination.totalPages).toBe(0);
  });

  it('gets safe metadata and translates a missing record', async () => {
    await expect(getProjectFile({ tenantId, projectId, fileId }, dependencies)).resolves.toEqual(
      safeDto,
    );
    dependencies.findProjectFileById.mockResolvedValue(null);
    await expect(
      getProjectFile({ tenantId, projectId, fileId }, dependencies),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_NOT_FOUND' });
  });

  it('prepares an internal streaming descriptor only after metadata lookup', async () => {
    const result = await prepareProjectFileDownload({ tenantId, projectId, fileId }, dependencies);
    expect(dependencies.findProjectFileById.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.openStoredFile.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({
      originalName: 'proposal.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 123,
    });
    expect(result.stream).toBeInstanceOf(Readable);
    expect(result).not.toHaveProperty('storagePath');
  });

  it('does not open storage for missing metadata', async () => {
    dependencies.findProjectFileById.mockResolvedValue(null);
    await expect(
      prepareProjectFileDownload({ tenantId, projectId, fileId }, dependencies),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_NOT_FOUND' });
    expect(dependencies.openStoredFile).not.toHaveBeenCalled();
  });

  it('translates missing content and invalid internal paths safely', async () => {
    dependencies.openStoredFile.mockRejectedValue(
      Object.assign(new Error('missing'), { code: 'ENOENT' }),
    );
    await expect(
      prepareProjectFileDownload({ tenantId, projectId, fileId }, dependencies),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_CONTENT_NOT_FOUND', statusCode: 404 });
    dependencies.openStoredFile.mockRejectedValue(
      Object.assign(new Error('private path'), {
        code: 'PROJECT_FILE_STORAGE_PATH_INVALID',
      }),
    );
    await expect(
      prepareProjectFileDownload({ tenantId, projectId, fileId }, dependencies),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_STORAGE_ERROR', statusCode: 500 });
  });

  it('updates only lifecycle metadata and clears a null description', async () => {
    await updateProjectFile(
      {
        tenantId,
        projectId,
        fileId,
        updates: { description: null, status: 'archived', storedName: 'attacker' },
      },
      dependencies,
    );
    expect(dependencies.updateProjectFileById).toHaveBeenCalledWith({
      tenantId,
      projectId,
      fileId,
      updates: { description: undefined, status: 'archived' },
    });
    expect(dependencies.removeStoredFile).not.toHaveBeenCalled();
  });

  it('translates a missing update target and rethrows unexpected errors', async () => {
    dependencies.updateProjectFileById.mockResolvedValue(null);
    await expect(
      updateProjectFile(
        { tenantId, projectId, fileId, updates: { status: 'active' } },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_FILE_NOT_FOUND' });
    const unexpected = new Error('repository failed');
    dependencies.findProjectById.mockRejectedValue(unexpected);
    await expect(
      listProjectFiles({ tenantId, projectId, page: 1, limit: 20 }, dependencies),
    ).rejects.toBe(unexpected);
  });
});
