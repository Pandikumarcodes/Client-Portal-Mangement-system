import { mkdtemp, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../src/core/errors/api-error.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';
import { createProjectFileUploadMiddleware } from '../../../src/modules/project-files/project-file-upload.middleware.js';

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

const { createProjectFileRouter } =
  await import('../../../src/modules/project-files/project-file.routes.js');

const projectId = 'abcdefabcdef123456789012';
const fileId = '1234567890abcdef12345678';
const file = {
  id: fileId,
  projectId,
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4,
  description: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
let storageRoot;
let testApp;

const createTestApp = () => {
  const services = {
    uploadProjectFile: vi.fn().mockResolvedValue(file),
    listProjectFiles: vi.fn().mockResolvedValue({
      files: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    getProjectFile: vi.fn().mockResolvedValue(file),
    prepareProjectFileDownload: vi.fn().mockResolvedValue({
      stream: Readable.from('body'),
      originalName: 'proposal.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
    }),
    updateProjectFile: vi.fn(async ({ updates }) => ({ ...file, ...updates })),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/projects/:projectId/files',
    createProjectFileRouter({
      ...services,
      projectFileUploadMiddleware: createProjectFileUploadMiddleware({ storageRoot }),
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, services };
};

beforeAll(async () => {
  storageRoot = await mkdtemp(path.join(os.tmpdir(), 'project-file-routes-'));
});

afterAll(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});

beforeEach(() => {
  testApp = createTestApp();
  tokenMocks.verifyAccessToken.mockClear();
});

describe('Project File routes', () => {
  it.each([
    ['get', `/api/v1/projects/${projectId}/files`],
    ['post', `/api/v1/projects/${projectId}/files`],
  ])('requires authentication before validation for %s', async (method, url) => {
    const response = await request(testApp.app)[method](url);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it.each(['client-token', 'super-admin-token'])('forbids the %s role', async (token) => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files`)
      .set(auth(token));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('uploads one allowed file and passes trusted parent params and fields', async () => {
    const response = await request(testApp.app)
      .post(`/api/v1/projects/${projectId.toUpperCase()}/files`)
      .set(auth('organization-admin-token'))
      .field('description', '  Delivery  ')
      .attach('file', Buffer.from('body'), {
        filename: 'proposal.pdf',
        contentType: 'application/pdf',
      });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { file } });
    expect(testApp.services.uploadProjectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'trusted-tenant-id',
        projectId,
        description: 'Delivery',
        uploadedFile: expect.objectContaining({
          mimetype: 'application/pdf',
          size: 4,
        }),
      }),
    );
  });

  it('rejects missing, unsupported, and forbidden multipart metadata', async () => {
    const missing = await request(testApp.app)
      .post(`/api/v1/projects/${projectId}/files`)
      .set(auth('organization-admin-token'))
      .field('description', 'missing');
    const unsupported = await request(testApp.app)
      .post(`/api/v1/projects/${projectId}/files`)
      .set(auth('organization-admin-token'))
      .attach('file', Buffer.from('html'), {
        filename: 'page.html',
        contentType: 'text/html',
      });
    const tenant = await request(testApp.app)
      .post(`/api/v1/projects/${projectId}/files`)
      .set(auth('organization-admin-token'))
      .field('tenantId', 'attacker')
      .attach('file', Buffer.from('pdf'), {
        filename: 'file.pdf',
        contentType: 'application/pdf',
      });
    expect(missing.body.error.code).toBe('PROJECT_FILE_REQUIRED');
    expect(unsupported.body.error.code).toBe('PROJECT_FILE_TYPE_NOT_ALLOWED');
    expect(tenant.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists with validated defaults and status filters', async () => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files?status=archived`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(200);
    expect(testApp.services.listProjectFiles).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      page: 1,
      limit: 20,
      status: 'archived',
    });
  });

  it('gets safe metadata and downloads through the protected route', async () => {
    const metadata = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files/${fileId}`)
      .set(auth('organization-admin-token'));
    const download = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files/${fileId}/download`)
      .set(auth('organization-admin-token'));
    expect(metadata.status).toBe(200);
    expect(metadata.body.data.file).toEqual(file);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment;');
    expect(download.body.toString()).toBe('body');
  });

  it('archives and restores metadata while rejecting empty or immutable updates', async () => {
    for (const status of ['archived', 'active']) {
      const response = await request(testApp.app)
        .patch(`/api/v1/projects/${projectId}/files/${fileId}`)
        .set(auth('organization-admin-token'))
        .send({ status });
      expect(response.status).toBe(200);
      expect(response.body.data.file.status).toBe(status);
    }
    for (const body of [{}, { storedName: 'attacker.pdf' }, { originalName: 'replacement.pdf' }]) {
      const response = await request(testApp.app)
        .patch(`/api/v1/projects/${projectId}/files/${fileId}`)
        .set(auth('organization-admin-token'))
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects invalid IDs with safe validation errors', async () => {
    const invalidProject = await request(testApp.app)
      .get('/api/v1/projects/private-project/files')
      .set(auth('organization-admin-token'));
    const invalidFile = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files/private-file`)
      .set(auth('organization-admin-token'));
    expect(invalidProject.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidFile.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify([invalidProject.body, invalidFile.body])).not.toContain('private-');
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['PROJECT_FILE_NOT_FOUND', 'The project file was not found.'],
    ['PROJECT_FILE_CONTENT_NOT_FOUND', 'The project file content was not found.'],
  ])('preserves safe %s service errors', async (code, message) => {
    const service =
      code === 'PROJECT_FILE_CONTENT_NOT_FOUND'
        ? testApp.services.prepareProjectFileDownload
        : testApp.services.getProjectFile;
    service.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code,
        message,
      }),
    );
    const suffix = code === 'PROJECT_FILE_CONTENT_NOT_FOUND' ? '/download' : '';
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/files/${fileId}${suffix}`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({ code, message });
  });

  it.each(['delete', 'put'])('does not register %s replacement/deletion', async (method) => {
    const client = request(testApp.app);
    const response = await client[method](`/api/v1/projects/${projectId}/files/${fileId}`).set(
      auth('organization-admin-token'),
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('does not expose tenant IDs, paths, or tokens in validation errors', async () => {
    const response = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}/files/${fileId}`)
      .set(auth('organization-admin-token'))
      .send({
        tenantId: 'private-tenant',
        storagePath: 'C:\\private\\file',
        accessToken: 'private-token',
      });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('trusted-tenant-id');
    expect(serialized).not.toContain('private-tenant');
    expect(serialized).not.toContain('C:\\private');
    expect(serialized).not.toContain('private-token');
    expect(serialized).not.toContain('organization-admin-token');
  });
});
