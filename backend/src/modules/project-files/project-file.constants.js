export const PROJECT_FILE_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const PROJECT_FILE_LIMITS = Object.freeze({
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_FILES_PER_UPLOAD: 1,
});

export const ALLOWED_PROJECT_FILE_TYPES = Object.freeze([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
