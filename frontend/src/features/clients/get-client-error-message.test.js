import { describe, expect, it } from 'vitest';
import { getClientErrorMessage } from './get-client-error-message.js';

describe('safe Client error mapping', () => {
  it.each([
    ['CLIENT_EMAIL_ALREADY_IN_USE', 'A client with this email already exists.'],
    ['CLIENT_NOT_FOUND', 'The client was not found.'],
    ['VALIDATION_ERROR', 'Check the client information and try again.'],
    ['AUTHENTICATION_REQUIRED', 'Your session has expired. Sign in again.'],
    ['FORBIDDEN', 'You do not have permission to manage clients.'],
    ['NETWORK_ERROR', 'Unable to connect to the server. Check your connection and try again.'],
  ])('maps %s', (code, expected) => {
    expect(getClientErrorMessage({ code, message: 'raw internal response' })).toBe(expected);
  });

  it('uses a generic message for unknown errors without exposing internals or tokens', () => {
    const result = getClientErrorMessage({
      code: 'INTERNAL_FAILURE',
      message: 'Database failed token=very-secret-token',
      stack: 'private stack',
    });
    expect(result).toBe('Something went wrong. Please try again.');
    expect(result).not.toContain('Database');
    expect(result).not.toContain('very-secret-token');
  });
});
