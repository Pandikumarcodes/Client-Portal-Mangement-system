const messages = Object.freeze({
  PROJECT_NOT_FOUND: 'The project was not found.',
  INVOICE_NOT_FOUND: 'The invoice was not found.',
  INVOICE_DATE_RANGE_INVALID: 'The due date must be on or after the issue date.',
  VALIDATION_ERROR: 'Check the invoice information and try again.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Sign in again.',
  FORBIDDEN: 'You do not have permission to manage invoices.',
  NETWORK_ERROR: 'Unable to connect to the server. Check your connection and try again.',
  INVALID_RESPONSE: 'The server returned an invalid response. Please try again.',
});

export function getInvoiceErrorMessage(error) {
  return messages[error?.code] ?? 'Something went wrong. Please try again.';
}
