# ADR-015: Authentication HTTP Boundary and Refresh Cookie

## Status

Accepted

## Decision

Expose `POST /api/v1/auth/register` and `POST /api/v1/auth/login`. Request validation runs before
controllers through the existing `validateRequest` middleware, and controllers consume only
`request.validated.body` under `asyncHandler`.

Access tokens are returned in JSON. Refresh tokens are stored in the
`client_portal_refresh_token` HTTP-only cookie and are never returned in JSON. The cookie uses
SameSite Lax, the `/api/v1/auth` path, a seven-day lifetime, and Secure only in production. The
configured `CLIENT_URL` remains the sole allowed CORS origin with credentials enabled.

Authentication failures use the centralized error response contract. Controllers explicitly map only
safe organization, user, and access-token fields and never expose refresh tokens, credentials, hashes,
or Mongoose internals.

## Consequences

The frontend must send `credentials: 'include'` when using the refresh cookie. Access tokens remain
JSON responses and are intended for frontend memory only. Logout, refresh, cookie clearing, CSRF
protection, token persistence/revocation, authentication middleware, authorization, and protected
endpoints remain deferred.
