# ADR-014: MVP Registration and Login Core

## Status

Accepted

## Context

The portal has User and Organization persistence, password utilities, and JWT primitives. The MVP
now needs service-layer operations to register an Organization with its first admin and authenticate
existing users without adding HTTP wiring or refresh-token state.

## Decision

Registration creates one Organization and one active Organization Admin atomically in a Mongoose
transaction. The first admin represents the initial organization ownership relationship; no `ownerId`
or separate ownership collection is introduced. Email uniqueness is global, and duplicate email or
organization slug errors are translated to safe 409 application errors.

Registration hashes passwords before persistence and returns only safe Organization, User, and
stateless access/refresh token data. Login finds users by normalized email with `passwordHash`
explicitly selected, then verifies credentials through the password utility. Missing users,
incorrect passwords, and malformed hashes share one generic invalid-credentials response.

Suspended users and Organizations cannot authenticate. Invited users are not active. Super Admin is
platform-level and does not query or return an Organization; tenant users load their Organization
and require it to be active.

## Consequences

Authentication services use dependency injection for offline testing while production defaults use
the repository, password, and token utilities. Safe response mapping excludes password hashes and
Mongoose internals and freezes returned result objects.

Refresh-token storage and revocation remain deferred. HTTP controllers, routes, cookies,
authentication/authorization middleware, registration endpoints, and login endpoints are deferred to
later work.
