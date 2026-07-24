# ADR-013: Keep JWT Access and Refresh Tokens in a Reusable Boundary

## Status

Accepted

## Context

The portal needs reusable token infrastructure for future authentication workflows without adding
registration, login, middleware, routes, or token persistence. Tokens must carry only the minimum
identity information needed by later services and must preserve the existing tenant-role model.

## Decision

Use `jsonwebtoken` in `src/modules/auth/token.js` with separate configured secrets for access and
refresh tokens. Access tokens last 15 minutes; refresh tokens last 7 days. Both use HS256, issuer
`client-management-portal-api`, and audience `client-management-portal`, and verification checks all
three values plus expiration.

Access and refresh payloads contain `sub`, `role`, `tokenType`, and `tenantId` only for tenant users.
Super Admin identities omit `tenantId`; Organization Admin and Client identities require it. Refresh
tokens additionally contain a generated UUID `jti`.

Verification returns a frozen normalized identity and returns `null` for invalid signatures,
malformed, expired, incorrectly scoped, or incorrectly typed tokens without exposing library errors.
Token creation rejects invalid identities with fixed safe errors. Secrets are at least 32 characters,
must differ, and are read only through centralized environment configuration.

## Alternatives considered

Configurable lifetimes were deferred to keep the MVP policy explicit. A shared secret was rejected
because access and refresh tokens have different risk and lifecycle requirements. Passport and other
authentication frameworks were rejected because this increment provides only reusable JWT primitives.

## Consequences

Future authentication services can create and verify narrowly scoped tokens without importing the
User model or connecting to MongoDB. Token storage, rotation, revocation, cookies, authentication
middleware, authorization, routes, and controllers remain deferred.
