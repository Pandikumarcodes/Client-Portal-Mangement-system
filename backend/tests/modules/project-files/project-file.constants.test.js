import { describe, expect, it } from 'vitest';

import {
  ALLOWED_PROJECT_FILE_TYPES,
  PROJECT_FILE_LIMITS,
  PROJECT_FILE_STATUS,
} from '../../../src/modules/project-files/project-file.constants.js';

describe('Project File constants', () => {
  it('defines only frozen active and archived statuses', () => {
    expect(Object.isFrozen(PROJECT_FILE_STATUS)).toBe(true);
    expect(PROJECT_FILE_STATUS).toEqual({ ACTIVE: 'active', ARCHIVED: 'archived' });
  });

  it('defines the frozen one-file 10 MiB boundary', () => {
    expect(Object.isFrozen(PROJECT_FILE_LIMITS)).toBe(true);
    expect(PROJECT_FILE_LIMITS).toEqual({
      MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
      MAX_FILES_PER_UPLOAD: 1,
    });
  });

  it('defines an immutable exact safe MIME allowlist', () => {
    expect(Object.isFrozen(ALLOWED_PROJECT_FILE_TYPES)).toBe(true);
    expect(ALLOWED_PROJECT_FILE_TYPES).toEqual([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    expect(ALLOWED_PROJECT_FILE_TYPES).not.toContain('application/x-msdownload');
    expect(ALLOWED_PROJECT_FILE_TYPES).not.toContain('text/html');
    expect(ALLOWED_PROJECT_FILE_TYPES).not.toContain('image/svg+xml');
    expect(ALLOWED_PROJECT_FILE_TYPES).not.toContain('application/zip');
  });
});
