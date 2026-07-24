# ADR-016: Complete the MVP Authentication Lifecycle

## Status

Accepted

## Decision

Bearer access tokens are authenticated by `authenticateRequest`, which verifies the access token and
assigns only `{ userId, role, tenantId? }` to the frozen `request.auth` context. Role guards validate
configured roles, and tenant context is accepted only from that verified identity; client body,
query, route, and header values are never trusted for tenant scope.

`POST /api/v1/auth/refresh` reads the HTTP-only refresh cookie, verifies the token against the current
User and Organization state, and rotates both access and refresh tokens. `POST /api/v1/auth/logout`
clears the same cookie and returns 204. Authentication failures remain generic and use the centralized
error contract.

Refresh tokens remain stateless: no persistent session store or revocation database exists yet. Logout
clears the browser cookie but cannot invalidate a copied refresh token. Persistent session revocation
may be added after MVP launch. Future tenant repositories must always scope queries using
`request.auth.tenantId`.

Client and project APIs, authorization policies beyond role/tenant guards, and frontend code remain
deferred.
