import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage } from './get-auth-error-message.js';

describe('safe auth error mapping', () => {
  it.each([
    ['INVALID_CREDENTIALS', 'The email or password is incorrect.'],
    ['EMAIL_ALREADY_IN_USE', 'An account with this email already exists.'],
    ['ORGANIZATION_SLUG_ALREADY_IN_USE', 'This organization URL is already in use.'],
    ['ACCOUNT_SUSPENDED', 'This account is suspended.'],
    ['ACCOUNT_NOT_ACTIVE', 'This account is not active.'],
    ['ORGANIZATION_SUSPENDED', 'This organization is suspended.'],
    ['VALIDATION_ERROR', 'Check the form and correct the highlighted information.'],
    ['NETWORK_ERROR', 'Unable to connect to the server. Check your connection and try again.'],
  ])('maps %s safely', (code, message) => expect(getAuthErrorMessage({ code, message: 'raw secret token' })).toBe(message));

  it('does not expose unknown raw messages or token values', () => {
    expect(getAuthErrorMessage(new Error('token=secret-value'))).toBe('Something went wrong. Please try again.');
  });
});
