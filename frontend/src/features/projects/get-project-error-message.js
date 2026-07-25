const messages = Object.freeze({
  CLIENT_NOT_FOUND: 'The selected client is unavailable. Choose another client and try again.',
  PROJECT_NOT_FOUND: 'The project was not found.',
  VALIDATION_ERROR: 'Check the project information and try again.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to manage projects.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
  INVALID_RESPONSE: 'The server returned an invalid response. Please try again.',
});

export function getProjectErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
