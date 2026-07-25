const messages = Object.freeze({
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to view this dashboard.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
  INVALID_RESPONSE: 'The server returned an invalid dashboard response. Please try again.',
});

export function getDashboardErrorMessage(error) {
  return messages[error?.code] ?? 'The dashboard could not be loaded. Please try again.';
}
