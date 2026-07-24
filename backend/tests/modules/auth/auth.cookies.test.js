import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ nodeEnv: 'development' }));

vi.mock('../../../src/config/env.js', () => ({ env: state }));

import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../../../src/modules/auth/auth.cookies.js';

const refreshToken = 'refresh-token-value';

describe('refresh token cookie helper', () => {
  beforeEach(() => {
    state.nodeEnv = 'development';
  });

  it('sets the secure HTTP-only refresh cookie with the required options', () => {
    const response = { cookie: vi.fn() };

    expect(setRefreshTokenCookie(response, refreshToken)).toBeUndefined();
    expect(response.cookie).toHaveBeenCalledWith('client_portal_refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it('sets Secure only in production', () => {
    const response = { cookie: vi.fn() };
    state.nodeEnv = 'production';

    setRefreshTokenCookie(response, refreshToken);

    expect(response.cookie.mock.calls[0][2].secure).toBe(true);
  });

  it('reads a valid refresh cookie and returns null for missing or invalid values', () => {
    expect(getRefreshTokenCookie({ cookies: { client_portal_refresh_token: refreshToken } })).toBe(
      refreshToken,
    );
    expect(getRefreshTokenCookie({ cookies: {} })).toBeNull();
    expect(getRefreshTokenCookie({})).toBeNull();
    expect(getRefreshTokenCookie({ cookies: { client_portal_refresh_token: '' } })).toBeNull();
    expect(getRefreshTokenCookie({ cookies: { client_portal_refresh_token: 42 } })).toBeNull();
  });

  it('clears the refresh cookie with matching security options and no maxAge', () => {
    const response = { clearCookie: vi.fn() };

    clearRefreshTokenCookie(response);

    expect(response.clearCookie).toHaveBeenCalledWith('client_portal_refresh_token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
    expect(response.clearCookie.mock.calls[0][1]).not.toHaveProperty('maxAge');
  });

  it.each(['', undefined, null, 42, {}])('rejects invalid refresh tokens safely', (token) => {
    const response = { cookie: vi.fn() };

    expect(() => setRefreshTokenCookie(response, token)).toThrow(TypeError);
    expect(() => setRefreshTokenCookie(response, token)).toThrow(
      'Refresh token must be a non-empty string.',
    );
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('does not log, read process.env directly, or expose the token in errors', async () => {
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync(new URL('../../../src/modules/auth/auth.cookies.js', import.meta.url), 'utf8'),
    );
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => setRefreshTokenCookie({ cookie: vi.fn() }, '')).toThrow();
    expect(source).not.toContain('process.env');
    expect(consoleLog).not.toHaveBeenCalled();
    expect(() => setRefreshTokenCookie({ cookie: vi.fn() }, refreshToken)).not.toThrow();
    consoleLog.mockRestore();
  });
});
