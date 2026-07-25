import { Readable } from 'node:stream';

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { asyncHandler } from '../../../src/core/errors/async-handler.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { createProjectFileController } from '../../../src/modules/project-files/project-file.controller.js';

const file = Object.freeze({
  id: 'file-id',
  projectId: 'project-id',
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4,
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const createResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe('Project File controller', () => {
  it('returns a frozen controller and uploads from trusted validated context', async () => {
    const uploadProjectFile = vi.fn().mockResolvedValue(file);
    const controller = createProjectFileController({ uploadProjectFile });
    const response = createResponse();
    const uploadedFile = { path: 'controlled', mimetype: 'application/pdf' };
    await controller.upload(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: {
          params: { projectId: 'validated-project' },
          body: { description: 'validated-description' },
        },
        body: { tenantId: 'attacker', description: 'raw-description' },
        file: uploadedFile,
      },
      response,
    );
    expect(Object.isFrozen(controller)).toBe(true);
    expect(uploadProjectFile).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'validated-project',
      description: 'validated-description',
      uploadedFile,
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { file } });
  });

  it('lists, gets, and updates using only validated values', async () => {
    const services = {
      listProjectFiles: vi.fn().mockResolvedValue({
        files: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
      getProjectFile: vi.fn().mockResolvedValue(file),
      updateProjectFile: vi.fn().mockResolvedValue({ ...file, status: 'archived' }),
    };
    const controller = createProjectFileController(services);
    const auth = { tenantId: 'trusted-tenant' };
    const response = createResponse();
    await controller.list(
      {
        auth,
        validated: {
          params: { projectId: 'project-id' },
          query: { page: 1, limit: 20, status: undefined },
        },
      },
      response,
    );
    await controller.getById(
      {
        auth,
        validated: { params: { projectId: 'project-id', fileId: 'file-id' } },
      },
      response,
    );
    await controller.update(
      {
        auth,
        validated: {
          params: { projectId: 'project-id', fileId: 'file-id' },
          body: { status: 'archived' },
        },
      },
      response,
    );
    expect(services.listProjectFiles).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      page: 1,
      limit: 20,
      status: undefined,
    });
    expect(services.getProjectFile).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      fileId: 'file-id',
    });
    expect(services.updateProjectFile).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      fileId: 'file-id',
      updates: { status: 'archived' },
    });
    expect(response.json.mock.calls.every(([body]) => body.success === true)).toBe(true);
  });

  it('streams a private attachment with trusted metadata and no JSON envelope', async () => {
    const prepareProjectFileDownload = vi.fn().mockResolvedValue({
      stream: Readable.from('body'),
      originalName: 'unsafe\r\nheader.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
    });
    const controller = createProjectFileController({ prepareProjectFileDownload });
    const app = express();
    app.get(
      '/download',
      (request_, response, next) => {
        request_.auth = { tenantId: 'trusted-tenant' };
        request_.validated = {
          params: { projectId: 'project-id', fileId: 'file-id' },
        };
        next();
      },
      asyncHandler(controller.download),
    );
    app.use(errorHandler);

    const response = await request(app).get('/download');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-length']).toBe('4');
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.headers['content-disposition']).not.toContain('\r');
    expect(response.headers['content-disposition']).not.toContain('\n');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.toString()).toBe('body');
    expect(prepareProjectFileDownload).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      fileId: 'file-id',
    });
  });

  it('propagates service failures without accessing models or filesystem paths', async () => {
    const failure = new Error('service failure');
    const getProjectFile = vi.fn().mockRejectedValue(failure);
    const controller = createProjectFileController({ getProjectFile });
    await expect(
      controller.getById(
        {
          auth: { tenantId: 'tenant' },
          validated: { params: { projectId: 'project', fileId: 'file' } },
        },
        createResponse(),
      ),
    ).rejects.toBe(failure);
  });
});
