const messages = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  EMAIL_ALREADY_IN_USE: 'An account with this email already exists.',
  ORGANIZATION_SLUG_ALREADY_IN_USE: 'This organization URL is already in use.',
  ACCOUNT_SUSPENDED: 'This account is suspended.',
  ACCOUNT_NOT_ACTIVE: 'This account is not active.',
  ORGANIZATION_SUSPENDED: 'This organization is suspended.',
  VALIDATION_ERROR: 'Check the form and correct the highlighted information.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
};

export function getAuthErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
