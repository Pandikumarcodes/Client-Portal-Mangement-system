const messages = Object.freeze({
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to manage project files.',
  VALIDATION_ERROR: 'Check the file information and try again.',
  PROJECT_NOT_FOUND: 'The project was not found.',
  PROJECT_FILE_REQUIRED: 'Select a file to upload.',
  PROJECT_FILE_TYPE_NOT_ALLOWED: 'Select a supported PDF, PNG, JPEG, text, CSV, Word, or Excel file.',
  PROJECT_FILE_TOO_LARGE: 'The file must not exceed 10 MiB.',
  PROJECT_FILE_UPLOAD_INVALID: 'The upload could not be accepted. Check the file and try again.',
  PROJECT_FILE_NOT_FOUND: 'The project file was not found.',
  PROJECT_FILE_CONTENT_NOT_FOUND: 'The file metadata exists, but its downloadable content is unavailable.',
  PROJECT_FILE_STORAGE_ERROR: 'The file could not be accessed. Please try again.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
  INVALID_RESPONSE: 'The server returned an invalid response. Please try again.',
});

export function getProjectFileErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
