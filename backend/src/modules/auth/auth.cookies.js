import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'client_portal_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function setRefreshTokenCookie(response, refreshToken) {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new TypeError('Refresh token must be a non-empty string.');
  }

  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function getRefreshTokenCookie(request) {
  const refreshToken = request?.cookies?.[REFRESH_COOKIE_NAME];

  return typeof refreshToken === 'string' && refreshToken.length > 0 ? refreshToken : null;
}

export function clearRefreshTokenCookie(response) {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}
