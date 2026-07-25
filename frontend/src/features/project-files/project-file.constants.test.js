import { describe, expect, it } from 'vitest';
import {
  PROJECT_FILE_MAX_SIZE_BYTES,
  PROJECT_FILE_MIME_TYPES,
  PROJECT_FILE_STATUS,
  PROJECT_FILE_STATUS_LABELS,
} from './project-file.constants.js';

describe('Project File constants', () => {
  it('protects the exact statuses and readable labels', () => {
    expect(PROJECT_FILE_STATUS).toEqual({ ACTIVE: 'active', ARCHIVED: 'archived' });
    expect(PROJECT_FILE_STATUS_LABELS).toEqual({ active: 'Active', archived: 'Archived' });
    expect(Object.isFrozen(PROJECT_FILE_STATUS)).toBe(true);
    expect(Object.isFrozen(PROJECT_FILE_MIME_TYPES)).toBe(true);
  });

  it('uses exactly 10 MiB and only backend-approved MIME types', () => {
    expect(PROJECT_FILE_MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(PROJECT_FILE_MIME_TYPES).toEqual([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    expect(PROJECT_FILE_MIME_TYPES).not.toContain('text/html');
    expect(PROJECT_FILE_MIME_TYPES).not.toContain('image/svg+xml');
    expect(PROJECT_FILE_MIME_TYPES).not.toContain('application/zip');
  });
});
