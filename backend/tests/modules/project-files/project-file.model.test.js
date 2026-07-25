import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { PROJECT_FILE_LIMITS } from '../../../src/modules/project-files/project-file.constants.js';
import { ProjectFile } from '../../../src/modules/project-files/project-file.model.js';

const validInput = () => ({
  tenantId: new mongoose.Types.ObjectId(),
  projectId: new mongoose.Types.ObjectId(),
  originalName: ' proposal.pdf ',
  storedName: 'random.pdf',
  storagePath: 'random.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 123,
  description: ' Delivered ',
});

describe('ProjectFile model', () => {
  it('registers on the default connection without connecting', () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    expect(ProjectFile.prototype).toBeInstanceOf(mongoose.Model);
    expect(ProjectFile.modelName).toBe('ProjectFile');
    expect(ProjectFile.collection.collectionName).toBe('project_files');
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });

  it('validates and normalizes a valid record offline', async () => {
    const file = new ProjectFile(validInput());
    await expect(file.validate()).resolves.toBeUndefined();
    expect(file.originalName).toBe('proposal.pdf');
    expect(file.description).toBe('Delivered');
    expect(file.status).toBe('active');
  });

  it.each([
    ['tenantId'],
    ['projectId'],
    ['originalName'],
    ['storedName'],
    ['storagePath'],
    ['mimeType'],
    ['sizeBytes'],
  ])('requires %s', async (field) => {
    const input = validInput();
    delete input[field];
    await expect(new ProjectFile(input).validate()).rejects.toThrow();
  });

  it('uses string references for tenant and Project ownership', () => {
    expect(ProjectFile.schema.path('tenantId').options.ref).toBe('Organization');
    expect(ProjectFile.schema.path('projectId').options.ref).toBe('Project');
  });

  it('enforces names, MIME types, sizes, description, and statuses', async () => {
    const cases = [
      { originalName: 'a'.repeat(256) },
      { mimeType: 'text/html' },
      { sizeBytes: 0 },
      { sizeBytes: 1.5 },
      { sizeBytes: PROJECT_FILE_LIMITS.MAX_FILE_SIZE_BYTES + 1 },
      { description: 'a'.repeat(501) },
      { status: 'deleted' },
    ];
    for (const patch of cases) {
      await expect(new ProjectFile({ ...validInput(), ...patch }).validate()).rejects.toThrow();
    }
    await expect(
      new ProjectFile({ ...validInput(), mimeType: 'image/png', status: 'archived' }).validate(),
    ).resolves.toBeUndefined();
  });

  it('keeps description optional and normalizes whitespace to undefined', async () => {
    const file = new ProjectFile({ ...validInput(), description: '   ' });
    await expect(file.validate()).resolves.toBeUndefined();
    expect(file.description).toBeUndefined();
  });

  it('uses timestamps, no version key, and throwing strict mode', () => {
    expect(ProjectFile.schema.options.timestamps).toBe(true);
    expect(ProjectFile.schema.options.versionKey).toBe(false);
    expect(ProjectFile.schema.options.strict).toBe('throw');
    expect(() => new ProjectFile({ ...validInput(), publicUrl: 'https://example.test' })).toThrow();
    for (const field of ['publicUrl', 'clientId', 'milestoneId', 'deletedAt']) {
      expect(ProjectFile.schema.path(field)).toBeUndefined();
    }
  });

  it('defines exactly the two required explicit indexes', () => {
    expect(ProjectFile.schema.indexes()).toEqual([
      [
        { tenantId: 1, projectId: 1, createdAt: -1 },
        { name: 'idx_project_files_tenant_project_created_at' },
      ],
      [
        { tenantId: 1, projectId: 1, status: 1, createdAt: -1 },
        { name: 'idx_project_files_tenant_project_status_created_at' },
      ],
    ]);
  });
});
