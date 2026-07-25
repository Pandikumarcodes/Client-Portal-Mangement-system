import { describe, expect, it } from 'vitest';

import {
  listProjectFilesQuerySchema,
  projectFileParamsSchema,
  projectFilesParamsSchema,
  updateProjectFileSchema,
  uploadProjectFileFieldsSchema,
} from '../../../src/modules/project-files/project-file.schemas.js';

const projectId = 'ABCDEFABCDEF123456789012';
const fileId = '1234567890ABCDEF12345678';

describe('Project File schemas', () => {
  it('parses and normalizes optional upload description', () => {
    expect(uploadProjectFileFieldsSchema.parse({ description: '  Delivery  ' })).toEqual({
      description: 'Delivery',
    });
    expect(uploadProjectFileFieldsSchema.parse({ description: '  ' })).toEqual({
      description: undefined,
    });
  });

  it('rejects long and unsupported multipart fields', () => {
    expect(() => uploadProjectFileFieldsSchema.parse({ description: 'a'.repeat(501) })).toThrow();
    for (const field of ['tenantId', 'projectId', 'status', 'storedName']) {
      expect(() => uploadProjectFileFieldsSchema.parse({ [field]: 'private' })).toThrow();
    }
  });

  it('accepts supported update fields and requires one', () => {
    expect(updateProjectFileSchema.parse({ description: null })).toEqual({ description: null });
    expect(updateProjectFileSchema.parse({ status: 'active' })).toEqual({ status: 'active' });
    expect(updateProjectFileSchema.parse({ status: 'archived' })).toEqual({
      status: 'archived',
    });
    expect(() => updateProjectFileSchema.parse({})).toThrow();
    expect(() => updateProjectFileSchema.parse({ status: 'deleted' })).toThrow();
  });

  it('rejects filename, storage, tenant, and immutable update fields', () => {
    for (const field of [
      'tenantId',
      'projectId',
      'originalName',
      'storedName',
      'storagePath',
      'mimeType',
      'sizeBytes',
      'createdAt',
      'updatedAt',
    ]) {
      expect(() => updateProjectFileSchema.parse({ [field]: 'private' })).toThrow();
    }
  });

  it('normalizes valid Project and file parameters and rejects invalid values', () => {
    expect(projectFilesParamsSchema.parse({ projectId })).toEqual({
      projectId: projectId.toLowerCase(),
    });
    expect(projectFileParamsSchema.parse({ projectId, fileId })).toEqual({
      projectId: projectId.toLowerCase(),
      fileId: fileId.toLowerCase(),
    });
    expect(() => projectFilesParamsSchema.parse({ projectId: 'private-invalid-id' })).toThrow();
    expect(() => projectFileParamsSchema.parse({ projectId, fileId: 'invalid' })).toThrow();
  });

  it('defaults and coerces listing pagination and accepts status', () => {
    expect(listProjectFilesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      listProjectFilesQuerySchema.parse({ page: '2', limit: '5', status: 'archived' }),
    ).toEqual({ page: 2, limit: 5, status: 'archived' });
    expect(() => listProjectFilesQuerySchema.parse({ limit: '51' })).toThrow();
    expect(() => listProjectFilesQuerySchema.parse({ tenantId: 'private' })).toThrow();
  });

  it('uses safe validation messages that do not repeat submitted values', () => {
    const privateValue = 'private-invalid-file-identifier';
    const result = projectFileParamsSchema.safeParse({ projectId, fileId: privateValue });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error.issues)).not.toContain(privateValue);
  });
});
