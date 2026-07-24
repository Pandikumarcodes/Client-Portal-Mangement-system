# ADR-012: Keep Password Hashing Outside the Mongoose Model

## Status

Accepted

## Context

The User model persists only `passwordHash`, but password hashing and verification require a
dedicated security boundary. Putting cryptographic work in Mongoose hooks would make persistence
behavior implicit, complicate testing, and risk double hashing or accidental credential handling.

The initial utility must support future registration and login without implementing either workflow.
It must also provide deterministic safe behavior for malformed stored hashes and must not trim
password input because whitespace may be intentional.

## Decision

Use `bcryptjs` in `src/modules/auth/password.js` with an internal work factor of 12. Export only
`hashPassword` and `verifyPassword`.

`hashPassword` accepts a non-empty string up to 128 characters and returns a salted bcrypt hash.
`verifyPassword` accepts the same password constraints and a non-empty hash, returning a boolean.
Malformed or unsupported hashes return `false` rather than exposing bcrypt internals. Password values
are not trimmed, stored, logged, or returned. Input errors use fixed safe messages without submitted
values.

Future registration services will hash before creating a User. Future login services will explicitly
select `passwordHash` only when verification is required. Password strength validation belongs in
request schemas, not this low-level utility. Password reset, peppering, hash migration, breached-
password checks, and email verification are deferred.

The User Mongoose model remains free of password hooks, methods, and comparison logic. No database
operation, authentication middleware, route, controller, service, or repository is introduced.

## Alternatives considered

Hashing inside Mongoose pre-save hooks was rejected because it couples cryptographic behavior to
persistence and can cause double hashing during updates. Storing raw passwords was rejected because
it violates the credential-safety boundary. `bcrypt`, Argon2, crypto-js, passport, jsonwebtoken,
and authentication frameworks were rejected because this MVP explicitly selects only bcryptjs and
does not implement authentication workflows.

Reading the work factor from environment configuration was rejected for this increment because a
fixed internal policy is sufficient. Manual salt generation and password trimming were rejected
because bcryptjs generates salts and whitespace is significant input.

## Consequences

Password security has a small reusable API that future authentication services can call explicitly.
Different hashes are produced for repeated hashing of the same password, and malformed stored data
fails closed as a boolean comparison.

The 128-character input limit and work factor are currently code-level policy. Future security work
must address strength validation, password reset, peppering, rehash migration, breached-password
checks, and authentication-specific error handling without moving cryptography into the User model.
