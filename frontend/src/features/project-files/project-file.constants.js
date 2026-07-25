export const PROJECT_FILE_STATUS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const PROJECT_FILE_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: PROJECT_FILE_STATUS.ACTIVE, label: 'Active' }),
  Object.freeze({ value: PROJECT_FILE_STATUS.ARCHIVED, label: 'Archived' }),
]);

export const PROJECT_FILE_STATUS_LABELS = Object.freeze(
  Object.fromEntries(PROJECT_FILE_STATUS_OPTIONS.map(({ value, label }) => [value, label])),
);

export const PROJECT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const PROJECT_FILE_PAGE_SIZE = 20;
export const PROJECT_FILE_DESCRIPTION_MAX_LENGTH = 500;

export const PROJECT_FILE_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const PROJECT_FILE_ACCEPT = PROJECT_FILE_MIME_TYPES.join(',');

export const PROJECT_FILE_TYPE_LABELS = Object.freeze({
  'application/pdf': 'PDF',
  'image/png': 'PNG image',
  'image/jpeg': 'JPEG image',
  'text/plain': 'Text file',
  'text/csv': 'CSV file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel workbook',
});
