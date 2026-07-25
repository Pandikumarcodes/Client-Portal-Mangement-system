import { ALLOWED_PROJECT_FILE_TYPES } from './project-file.constants.js';

const MIME_TO_EXTENSION = Object.freeze({
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
});

if (
  Object.keys(MIME_TO_EXTENSION).length !== ALLOWED_PROJECT_FILE_TYPES.length ||
  !ALLOWED_PROJECT_FILE_TYPES.every((mimeType) => MIME_TO_EXTENSION[mimeType])
) {
  throw new Error('Project File MIME configuration is invalid.');
}

export const getProjectFileExtension = (mimeType) => MIME_TO_EXTENSION[mimeType];
