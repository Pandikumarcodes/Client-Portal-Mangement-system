import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { createProjectFileUploadMiddleware } from '../../../src/modules/project-files/project-file-upload.middleware.js';

let storageRoot;
let app;

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(os.tmpdir(), 'project-file-upload-'));
  app = express();
  app.post('/upload', createProjectFileUploadMiddleware({ storageRoot }), (request_, response) => {
    response.status(200).json({
      originalName: request_.file.originalname,
      storedName: request_.file.filename,
      description: request_.body.description,
    });
  });
  app.use(errorHandler);
});

afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});

describe('Project File upload middleware', () => {
  it.each([
    ['application/pdf', 'proposal.pdf'],
    ['image/png', 'image.png'],
  ])('accepts one allowed %s upload', async (contentType, filename) => {
    const response = await request(app)
      .post('/upload')
      .field('description', 'Delivery')
      .attach('file', Buffer.from('allowed'), { filename, contentType });
    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Delivery');
    expect(response.body.storedName).not.toBe(filename);
    expect(response.body.storedName).toMatch(/^[a-f0-9]{48}\./);
  });

  it('requires one file', async () => {
    const response = await request(app).post('/upload').field('description', 'Missing');
    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'PROJECT_FILE_REQUIRED',
      message: 'A file is required.',
    });
  });

  it('rejects files over exactly 10 MiB', async () => {
    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PROJECT_FILE_TOO_LARGE');
  });

  it.each([
    ['text/html', 'page.html'],
    ['application/javascript', 'script.js'],
    ['image/svg+xml', 'vector.svg'],
    ['application/zip', 'archive.zip'],
  ])('rejects unsupported %s safely', async (contentType, filename) => {
    const response = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('private-content'), { filename, contentType });
    expect(response.status).toBe(415);
    expect(response.body.error).toEqual({
      code: 'PROJECT_FILE_TYPE_NOT_ALLOWED',
      message: 'The selected file type is not allowed.',
    });
  });

  it('rejects unexpected and multiple file structures', async () => {
    const unexpected = await request(app).post('/upload').attach('attachment', Buffer.from('one'), {
      filename: 'one.pdf',
      contentType: 'application/pdf',
    });
    const multiple = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('one'), {
        filename: 'one.pdf',
        contentType: 'application/pdf',
      })
      .attach('file', Buffer.from('two'), {
        filename: 'two.pdf',
        contentType: 'application/pdf',
      });
    expect(unexpected.status).toBe(400);
    expect(unexpected.body.error.code).toBe('PROJECT_FILE_UPLOAD_INVALID');
    expect(multiple.status).toBe(400);
    expect(multiple.body.error.code).toBe('PROJECT_FILE_UPLOAD_INVALID');
  });

  it('does not expose paths, filenames, tokens, or permit traversal storage names', async () => {
    const token = 'private-authorization-token';
    const response = await request(app)
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('safe'), {
        filename: '../../private-name.html',
        contentType: 'text/html',
      });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(storageRoot);
    expect(serialized).not.toContain('private-name');
    expect(serialized).not.toContain(token);
  });

  it('does not connect to MongoDB', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    await request(app).post('/upload').attach('file', Buffer.from('pdf'), {
      filename: 'file.pdf',
      contentType: 'application/pdf',
    });
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
