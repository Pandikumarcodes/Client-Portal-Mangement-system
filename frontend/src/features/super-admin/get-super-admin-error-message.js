const messages = Object.freeze({
  AUTHENTICATION_REQUIRED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have access to platform administration.',
  VALIDATION_ERROR: 'The requested platform data could not be loaded.',
  ORGANIZATION_NOT_FOUND: 'The organization was not found.',
  ORGANIZATION_SUSPENDED: 'The organization is suspended.',
  NETWORK_ERROR: 'Unable to connect. Check your connection and try again.',
});

export function getSuperAdminErrorMessage(error) {
  return messages[error?.code] ?? 'The request could not be completed. Please try again.';
}
