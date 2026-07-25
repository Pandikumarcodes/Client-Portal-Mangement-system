const messages = Object.freeze({
  PROJECT_NOT_FOUND: 'The project was not found.',
  MILESTONE_NOT_FOUND: 'The milestone was not found.',
  VALIDATION_ERROR: 'Check the milestone information and try again.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to manage milestones.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
  INVALID_RESPONSE: 'The server returned an invalid response. Please try again.',
});

export function getMilestoneErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
