const messages = Object.freeze({
  CLIENT_EMAIL_ALREADY_IN_USE: 'A client with this email already exists.',
  CLIENT_NOT_FOUND: 'The client was not found.',
  VALIDATION_ERROR: 'Check the client information and try again.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to manage clients.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
});

export function getClientErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
