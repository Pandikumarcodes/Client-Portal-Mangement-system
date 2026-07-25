# Agent Rules

- Work only on the requested prompt.
- Inspect existing code before changing it.
- Do not generate future modules.
- Use JavaScript and ES modules.
- Do not use CommonJS.
- Do not place business logic inside routes.
- Do not access MongoDB directly from routes.
- Every tenant-owned query must eventually include `tenantId`.
- Never commit secrets.
- Never include MongoDB credentials in logs or test fixtures.
- Access `process.env` only from `src/config/env.js`.
- Add future environment variables incrementally with the feature that requires them.
- Application code must never modify machine DNS configuration.
- Do not introduce `dns.setServers()` without an explicit architecture decision.
- Route Node.js DNS resolver overrides through `src/config/dns.js`.
- Future database code must not call `dns.setServers()` directly.
- Domain modules must not call `mongoose.connect()` or `mongoose.disconnect()`.
- Models contain persistence invariants only and must not contain HTTP logic.
- Organization is the tenant root and must not contain `tenantId`.
- Future tenant-owned schemas must require `tenantId` referencing Organization.
- Tenant-owned queries must always be scoped by `tenantId`; tenant-scoped uniqueness must use
  compound indexes containing `tenantId`.
- Unique indexes are database constraints, not replacements for safe application conflict
  handling.
- Routes must never access Mongoose models directly.
- Super Admin users are platform-level and must not be tenant scoped.
- Organization Admin and Client users must be tenant scoped through `tenantId`.
- Authentication services must never store raw passwords; only password hashes may persist.
- Password hashing must not be implemented through Mongoose hooks.
- Use the centralized `src/modules/auth/password.js` utilities for password hashing and
  verification. Password input must not be trimmed; whitespace is significant.
- Future authentication services may explicitly select `passwordHash` only when verification is
  required.
- JWT utilities must use the separate configured access and refresh secrets, HS256, the fixed
  issuer and audience, and minimal identity claims only.
- Access tokens last 15 minutes; refresh tokens last 7 days and include a generated `jti`.
- Super Admin tokens must omit `tenantId`; tenant-user tokens must require it. Never log, persist,
  or expose tokens or JWT secrets.
- Authentication schemas must reject unknown fields, normalize identity fields, and preserve
  password whitespace. Password strength rules belong to registration schemas.
- Registration must hash before persistence and create the Organization plus first admin in one
  transaction; never introduce `ownerId` or an ownership collection for this MVP.
- Authentication repository methods may access models but must not hash passwords, verify passwords,
  create tokens, or connect/disconnect MongoDB.
- Auth services must return safe frozen objects, translate only known duplicate email/slug errors,
  and use generic invalid-credentials responses without revealing account existence.
- Controllers must consume only `request.validated` and must never return refresh tokens in JSON.
- Access tokens must not be logged. Authentication cookies must remain HTTP-only.
- Authentication routes must apply `validateRequest` before `asyncHandler` and must not add logout,
  refresh, or protected endpoints in this MVP.
- CORS must retain the configured origin restriction and must never use a wildcard with credentials.
- Protected routes must run `authenticateRequest` first; role guards and tenant guards run only after
  authentication.
- Client records are always tenant scoped; future Client queries must include `tenantId` from
  `request.auth.tenantId`, never request body or query input.
- Every Project repository query must include `tenantId`; never use `findById` alone for Project
  records.
- Project tenant IDs come only from `request.auth.tenantId`, and Project HTTP responses must never
  expose `tenantId`.
- Verify Client ownership with both `tenantId` and `clientId` before Project creation or Client
  reassignment.
- Project routes must apply authentication, Organization Admin role authorization, and tenant
  context middleware in that order.
- Archive Projects through a status update, not deletion. Do not add milestones or progress without
  an approved prompt.
- Every ProjectFile query must include both `tenantId` and `projectId`, and every operation must
  verify the tenant-scoped Project first.
- ProjectFile tenant context comes only from `request.auth.tenantId`; never expose `storedName` or
  `storagePath`, and never use `originalName` as a storage filename.
- Use the Project File storage adapter instead of direct filesystem access in controllers and
  services. Never store file binaries in MongoDB or mount upload storage with `express.static`.
- Project File downloads must pass through authenticated routes. Do not add public links, hard
  deletion, Client access, previews, versioning, or cloud storage without an approved prompt.
- Archiving Project File metadata must not remove its stored content.
- Client profiles and User authentication identities are separate concepts. Client models must not
  perform HTTP or authentication workflows, and routes must not access models directly.
- Never trust tenant IDs from client input. Tenant-scoped repositories must use
  `request.auth.tenantId`.
- Refresh tokens must never appear in JSON or logs. Logout currently clears the cookie without
  server-side revocation because refresh sessions are not persisted.
- `passwordHash` must never be included in API responses or logs.
- Models must not generate JWTs or connect/disconnect MongoDB.
- Global email uniqueness is the initial User identity policy.
- Apply database DNS policy only through `src/config/dns.js`.
- Establish the database connection before future HTTP startup.
- `src/app.js` composes Express middleware and routes and must never call `listen()`.
- `src/server.js` owns HTTP startup and shutdown and must connect MongoDB before listening.
- `src/index.js` owns executable process startup and process signal handling.
- Register future business routes through application composition in `src/app.js`.
- Routes must forward failures to centralized error middleware.
- Wrap asynchronous route handlers with `asyncHandler` when they can reject.
- Every input-accepting route must use a module-owned Zod schema with `validateRequest`.
- Controllers must use `request.validated`, not raw `request.body`, `request.params`, or
  `request.query`.
- Forward validation failures to centralized error handling without exposing raw values or secrets.
- Keep business schemas inside their owning modules.
- Do not introduce global request-validation middleware.
- Routes and future controllers must never expose raw dependency errors.
- Add safe application error codes incrementally with the business module that needs them.
- Keep global error middleware last in `src/app.js`.
- Never send secrets, stacks, causes, or infrastructure errors to HTTP clients.
- Never include database credentials in logs or public errors.
- Use the centralized logger; do not create independent root loggers.
- Prefer `request.log` during HTTP handling and `getRequestId()` for correlation without retaining
  request objects.
- Never log passwords, tokens, authorization headers, cookies, request bodies, complete query
  objects, or MongoDB URIs.
- Do not use `console.log` in production application code; direct CLI diagnostic output is the
  narrow exception.
- Keep audit events separate from operational logs.
- Treat request IDs only as diagnostic correlation values, never authorization credentials.
- Keep `DNS_SERVERS` environment-specific; never hardcode resolver addresses.
- Run validation before completion.
- Summarize all changed files.
- Stop after the requested prompt.
