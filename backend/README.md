# Client Management Portal Backend

Backend foundation for a multi-tenant Client Management Portal. The project uses Node.js,
JavaScript, and ES modules, with a modular-monolith architecture direction.

## Prerequisites

- A supported Node.js LTS release
- npm

## Installation

```powershell
npm.cmd install
Copy-Item .env.example .env
```

The copied `.env` file is for local configuration. Replace its obvious MongoDB placeholder with a
developer-owned Atlas URI. Never commit or share `.env`.

## Environment configuration

Environment access is centralized in `src/config/env.js`. The module loads `.env` through dotenv,
validates and normalizes supported values with Zod, and exports an immutable configuration object.
Configuration is parsed once when the module is imported. Invalid supplied values throw a safe
error identifying the affected field without printing environment contents.

Currently supported variables:

| Variable      | Accepted values                                                 | Default             | Exported value   |
| ------------- | --------------------------------------------------------------- | ------------------- | ---------------- |
| `NODE_ENV`    | `development`, `test`, or `production`                          | `development`       | `env.nodeEnv`    |
| `PORT`        | Integer from `1` through `65535` as text                        | `5000`              | `env.port`       |
| `MONGO_URI`   | Required Atlas URI beginning with `mongodb+srv://`              | None                | `env.mongoUri`   |
| `DNS_SERVERS` | Optional comma-separated IPv4 or IPv6 addresses                 | Empty               | `env.dnsServers` |
| `CLIENT_URL`  | Required absolute HTTP or HTTPS URL                             | None                | `env.clientUrl`  |
| `LOG_LEVEL`   | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` | Environment-derived | `env.logLevel`   |

`PORT` is normalized to a number. `MONGO_URI` must be non-empty, safely parseable, and contain one
valid SRV hostname without an explicit port. `DNS_SERVERS` is normalized into a deduplicated,
immutable array. `CLIENT_URL` is the explicit credentials-enabled CORS origin and has a trailing
slash removed. Application modules must import `env` instead of reading `process.env` directly.
When `LOG_LEVEL` is absent or empty, it defaults to `debug` in development, `silent` in tests, and
`info` in production.

## Commands

```powershell
npm.cmd run dev
npm.cmd start
npm.cmd test
npm.cmd run validate
```

`npm.cmd run dev` runs the application with nodemon for development. `npm.cmd start` runs the same
executable entry point directly for production-style startup. Both commands connect MongoDB before
opening the HTTP listener, so they require valid local configuration and reachable infrastructure.

With the default port, the operational health endpoint is:

```text
http://localhost:5000/api/v1/health
```

The endpoint returns HTTP 200 when the Mongoose connection is ready and HTTP 503 otherwise. It
reports only service, environment, readiness status, database state, and a timestamp; it performs
no database query and exposes no connection details.

## Application and server lifecycle

`src/app.js` constructs a new Express application without opening a network port. Its foundational
middleware order is X-Powered-By removal, request ID assignment, asynchronous request context,
structured HTTP logging, Helmet, CORS, compression, JSON parsing, URL-encoded parsing, cookie
parsing, infrastructure and future application routes, centralized not-found handling, and global
error handling. The global error middleware remains last.

`src/server.js` owns the HTTP and database lifecycle. Startup connects MongoDB, constructs Express,
creates a Node HTTP server, and only resolves after the listener is accepting traffic. Concurrent
startup calls share one attempt. Graceful shutdown stops and closes HTTP traffic first, then
disconnects MongoDB. Concurrent shutdown calls also share one attempt, and a stopped application
can be started again.

`src/index.js` is the executable process boundary. It starts the server, registers one-time SIGINT
and SIGTERM handlers, and applies safe exit-code and console-message policy. Pressing Ctrl+C sends
SIGINT and initiates graceful shutdown without calling `process.exit()`.

## HTTP error responses

Handled HTTP failures use one JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

Unknown routes return this response with HTTP 404. Malformed JSON bodies return HTTP 400 with
`INVALID_JSON`, and request bodies exceeding the configured 1 MB limit return HTTP 413 with
`PAYLOAD_TOO_LARGE`.

Expected client-facing errors use `ApiError`. Optional `details` appear only when safe information
was explicitly supplied. Unknown failures return HTTP 500 with `INTERNAL_SERVER_ERROR` and a generic
message. HTTP responses never include internal error messages, causes, stack traces, filesystem
paths, MongoDB details, credentials, cookies, or authorization headers. Development mode does not
weaken this response policy.

Future asynchronous route handlers should use `asyncHandler` to forward failures without repeated
try/catch blocks.

## Request validation

`validateRequest` is the reusable Zod boundary for route input. Validation is registered per route,
never globally, and may compose body, route-parameter, and query schemas into one operation:

```js
router.post(
  '/resource/:resourceId',
  validateRequest({
    body: resourceBodySchema,
    params: resourceParamsSchema,
    query: resourceQuerySchema,
  }),
  asyncHandler(resourceController),
);
```

Successful parsing places only the validated sections and their transformed Zod output in a frozen
top-level object:

```js
request.validated = {
  body: {},
  params: {},
  query: {},
};
```

Future controllers must use `request.validated` rather than trusting `request.body`,
`request.params`, or `request.query`. The raw Express values are not mutated.

Validation failures flow through centralized error handling:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [
      {
        "field": "body.email",
        "code": "INVALID_FORMAT",
        "message": "Invalid email address."
      }
    ]
  }
}
```

Details contain at most 20 application-controlled issues and never contain submitted values,
passwords, tokens, complete request bodies, Zod internals, or credentials. Async Zod refinements are
supported. Unexpected schema execution failures remain internal and receive the generic HTTP 500
response.

Business schemas are not implemented yet. Future schemas belong inside their owning modules.
Header, cookie, file, and response validation are also deferred.

The current HTTP flow is foundational middleware, route-specific validation where configured,
route handlers, centralized not-found handling, and the final global error middleware.

## Organization tenant root

Organization is the root tenant document for the shared-collection multi-tenant architecture. Its
initial persistence fields are:

| Field    | Values or constraint                                               |
| -------- | ------------------------------------------------------------------ |
| `name`   | Trimmed string, 2–120 characters                                   |
| `slug`   | Lowercase letters and numbers with single hyphens, 2–80 characters |
| `status` | `active` or `suspended`; defaults to `active`                      |
| `plan`   | `free` or `pro`; defaults to `free`                                |

Organization itself does not contain `tenantId`. Future tenant-owned models such as users, clients,
projects, invoices, and files must require `tenantId` referencing Organization, and their queries
must be tenant-scoped.

Organization slugs are globally unique in the first version through the named
`uniq_organizations_slug` database index. The index is a persistence constraint, not a complete
application validation strategy. A future onboarding service will own slug generation, conflict
resolution, and safe duplicate-key error translation.

Importing the Organization model registers it on the default Mongoose connection but does not
connect to MongoDB. Organization APIs, onboarding, owner relationships, authentication, and
tenant-isolation middleware are not implemented.

## User identity and tenant membership

The initial User model represents three identities:

| Role               | Stored value         | Tenant membership             |
| ------------------ | -------------------- | ----------------------------- |
| Super Admin        | `super_admin`        | Platform-level; no `tenantId` |
| Organization Admin | `organization_admin` | Requires one `tenantId`       |
| Client             | `client`             | Requires one `tenantId`       |

User statuses are `active`, `invited`, and `suspended`; new users default to `active`. The model
persists only `passwordHash`, never a raw password, and marks it `select: false` for query safety.
Password hashing, password verification, registration, login, JWTs, invitations, and authorization
are not implemented.

Email is trimmed, lowercased, and globally unique through the named `uniq_users_email` database
index. A tenant lookup index exists on `tenantId`. These indexes are database constraints; future
services must translate duplicate-key failures into safe application errors.

Organization Admin and Client users belong to at most one Organization initially. Referential
Organization existence is not queried during document validation and will be enforced by future
services and repositories. Importing the User model registers it on the default Mongoose connection
without connecting to MongoDB. User APIs, authentication workflows, and tenant middleware are not
implemented.

## Password hashing boundary

The reusable `hashPassword` and `verifyPassword` utilities live outside the User Mongoose model in
`src/modules/auth/password.js` and use `bcryptjs` with work factor 12. Password input is required
to be a non-empty string no longer than 128 characters; it is never trimmed, because whitespace is
significant.

`hashPassword` returns a bcrypt hash. `verifyPassword` returns `true` or `false`, treating malformed
or unsupported stored hashes as failed comparisons. Raw passwords are never persisted, logged, or
returned, and `passwordHash` remains excluded by default from User queries.

Future registration will hash before persistence, and future login will explicitly select
`passwordHash` only for verification. Password strength schemas, password reset, peppering, hash
migration, breached-password checks, registration, login, and authentication middleware are not
implemented.

## JWT token boundary

Reusable access- and refresh-token utilities live in `src/modules/auth/token.js`. Access tokens
last 15 minutes and refresh tokens last 7 days. They use separate `JWT_ACCESS_SECRET` and
`JWT_REFRESH_SECRET` values, sign with HS256, and require the issuer
`client-management-portal-api` and audience `client-management-portal` during verification.

Tokens contain only `sub`, `role`, `tokenType`, and the applicable `tenantId`; refresh tokens also
contain a generated `jti`. Super Admin identities never include `tenantId`; Organization Admin and
Client identities require it. Verification returns a frozen normalized identity or `null` for any
invalid token without exposing library errors. Secret values must be at least 32 characters and
must differ; keep them only in private environment configuration.

Token storage, rotation, revocation, authentication middleware, and authentication routes are not
implemented.

## MVP registration and login core

Authentication schemas, a transactional authentication repository, and dependency-injected
registration/login services now provide the service-layer core. Registration creates an Organization
and its first active Organization Admin atomically; the first admin represents initial ownership
without an `ownerId`. Registration hashes passwords before persistence and returns safe user and
organization data with stateless access and refresh tokens.

Login uses normalized email lookup with explicit `passwordHash` selection, generic invalid-
credentials errors, suspended-account and suspended-Organization checks, and no Organization query
for Super Admin. Password hashes, credentials, tokens, and Mongoose internals are never returned.
Refresh-token storage/revocation and all HTTP controllers, routes, cookies, and authentication or
authorization middleware remain deferred.

## Authentication HTTP endpoints

The initial HTTP boundary exposes:

- `POST /api/v1/auth/register` — validates registration input, creates the Organization and first
  admin, returns HTTP 201, and returns the access token in JSON.
- `POST /api/v1/auth/login` — validates login input, authenticates the user, returns HTTP 200, and
  returns the access token in JSON.

Both responses use `{ success: true, data: { organization, user, accessToken } }`. The refresh token
is never included in JSON; it is set in the `client_portal_refresh_token` HTTP-only cookie with
SameSite Lax, `/api/v1/auth` path, seven-day lifetime, and Secure enabled in production. Browser
clients must send `credentials: 'include'` for cookie-based requests. CORS permits only the
configured `CLIENT_URL` and enables credentials.

Refresh, logout, cookie clearing, protected endpoints, and authentication middleware are not yet
implemented.

## Authentication lifecycle

The lifecycle now also exposes `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout`. Refresh
reads the HTTP-only cookie, verifies the current User and Organization state, and rotates the access
and refresh tokens. Logout clears the cookie and returns HTTP 204; it cannot revoke a copied token
because refresh-token sessions are not persisted yet.

Protected routes can use `Authorization: Bearer <access-token>`. `authenticateRequest` assigns the
frozen `{ userId, role, tenantId? }` contract to `request.auth`. `requireRoles(...)` enforces role
membership, while `requireTenantContext` accepts tenant context only from verified `request.auth`.
Super Admin is excluded from tenant context, and tenant repositories must scope queries with
`request.auth.tenantId`.

Frontend flow: register or login, keep the access token in memory, send the refresh cookie with
`credentials: 'include'`, call `/refresh` after reload, send the access token in the Authorization
header, and call `/logout` while clearing frontend state.

Persistent refresh-session revocation and frontend authentication screens remain deferred.

## Client profiles

Client profiles are minimal tenant-owned business-customer records separate from User authentication
identities. Each Client requires an Organization `tenantId` and stores `firstName`, `lastName`,
`email`, optional `companyName`, `status`, and an optional `userId` for future portal-account linking.
Email uniqueness is scoped to each Organization, so the same address may exist in different tenants.

Client create, list, get, and update APIs are available to authenticated Organization Admin users.
Invitations, account linking, frontend screens, and invoices are not implemented. Client queries use
`request.auth.tenantId`; tenant ownership never comes from request body or query input.

## Projects

Projects are minimal tenant-owned delivery records assigned to one existing Client profile:

| Field         | Values or constraint                                            |
| ------------- | --------------------------------------------------------------- |
| `clientId`    | Required Client ObjectId owned by the same Organization         |
| `name`        | Required trimmed string, 2-150 characters                       |
| `description` | Optional trimmed string, at most 2000 characters                |
| `status`      | `active`, `on_hold`, `completed`, or `archived`; default active |

The authenticated Organization's tenant ID comes only from `request.auth.tenantId` and is never
accepted from request input or returned in Project responses. Before Project creation or Client
reassignment, the service verifies the Client with both `tenantId` and `clientId`. Missing and
cross-tenant Clients are intentionally indistinguishable.

Authenticated Organization Admin users can use:

- `POST /api/v1/projects` to create a Project for an existing tenant-owned Client.
- `GET /api/v1/projects` to list Projects newest first.
- `GET /api/v1/projects/:projectId` to get one tenant-scoped Project.
- `PATCH /api/v1/projects/:projectId` to update its Client, name, description, or status.

List requests support `page` (default 1), `limit` (default 20, maximum 50), optional `status`, and
optional `clientId`. Text search and sorting controls are not supported. There is no DELETE endpoint;
archiving uses the normal status update and archived Projects remain stored. Project names are not
unique.

Safe Project-route errors include `PROJECT_NOT_FOUND`, `CLIENT_NOT_FOUND`, `VALIDATION_ERROR`,
`AUTHENTICATION_REQUIRED`, and `FORBIDDEN`. Project frontend screens, Client portal Project access,
milestones, files, invoices, dates, budgets, progress, comments, and activity feeds are not
implemented.

## Structured logging and request correlation

The application uses one centralized Pino logger and emits newline-delimited JSON without
`pino-pretty`. Every HTTP request receives an `X-Request-Id`. A client-supplied value is retained
only when it is 1–100 characters and contains letters, numbers, hyphens, underscores, or periods;
invalid values are replaced with generated UUIDs.

Correlation is established before pino-http runs:

```text
X-Request-Id selection
→ AsyncLocalStorage request context
→ pino-http request-scoped logger
→ route and error handling
→ one HTTP completion log
```

`request.log` is available during HTTP handling. Code that should not receive or retain an Express
request can use `getRequestId()` to access only the current correlation ID across promises and
timers.

Ordinary HTTP completion logs contain only request ID, method, URL path, status code, and response
time. Query-string values, request bodies, authorization headers, cookies, Set-Cookie values,
passwords, tokens, uploaded content, complete request/response objects, and MongoDB configuration
are excluded. Responses below 400 log at info, 4xx responses at warn, and 5xx responses at error.
Unknown HTTP failures also produce one safe metadata-only error event; HTTP error responses remain
unchanged.

Application lifecycle events use the same root logger. The MongoDB diagnostic CLI scripts retain
their intentional terminal output. External log shipping, persistent storage, tracing, metrics,
and audit logging are not implemented; audit events will remain separate from operational logs.

## Database connection lifecycle

The explicit database lifecycle is centralized in `src/config/database.js`. It applies the
environment-configured DNS resolver policy, deduplicates concurrent startup attempts, connects the
single Mongoose default connection, exposes side-effect-free readiness inspection, and disconnects
cleanly. Connection and disconnection errors use fixed safe messages while retaining their original
causes for controlled diagnostics.

Importing the database, application, or server modules does not connect to MongoDB or open an HTTP
listener. The executable process layer calls the lifecycle before starting HTTP traffic and during
graceful shutdown.

Domain modules must not call `mongoose.connect()` or `mongoose.disconnect()` or create independent
connections.

## MongoDB diagnostics

After setting a real developer-owned `MONGO_URI`, run:

```powershell
npm.cmd run db:dns-check
npm.cmd run db:check
```

`DNS_SERVERS` is optional and should remain empty wherever the default resolver works. If the
current Node.js process requires an override, use a comma-separated value such as:

```dotenv
DNS_SERVERS=1.1.1.1,8.8.8.8
```

The override changes resolver behavior only for the current Node.js process. It does not change
Windows DNS settings, network-adapter configuration, or resolver behavior for other applications.
The configured policy is applied before the DNS preflight performs SRV discovery.

The `db:dns-check` command checks which DNS resolvers Node.js sees and whether they can resolve the Atlas
`_mongodb._tcp` SRV record. It reports the cluster hostname, configured resolvers, record count,
resolved targets, and categorized DNS failures without printing the URI or credentials. It also
warns when only loopback resolvers are configured.

The preflight does not connect to MongoDB, test credentials, verify the Atlas IP access list, or
confirm database availability. A successful result proves DNS SRV discovery only; it does not prove
authentication or Atlas network access.

The `db:check` command applies the same DNS policy and attempts an actual Mongoose connection. It
therefore verifies DNS discovery, credentials, Atlas network access, server selection, and database
connectivity. It reports only a safe cause type, cause code when available, and diagnostic category
on failure. It never prints the raw dependency error.

Run the commands in order when troubleshooting:

1. Run `npm.cmd run db:dns-check` to test Atlas SRV discovery without connecting to MongoDB.
2. Run `npm.cmd run db:check` to verify the real database connection and then disconnect.
3. Run `npm.cmd run dev` to connect the database and operate the full development HTTP process.
4. Check the local `DNS_SERVERS` value and Atlas network access list as appropriate without sharing
   `.env`, the MongoDB URI, credentials, raw errors, or stack traces.

## Current status

The backend implements centralized configuration, database and HTTP lifecycle management, health
checks, safe errors and validation, structured logging and request correlation, authentication
lifecycle endpoints, tenant authorization, Client management APIs, and the minimal Project API.
Organization is the tenant root, and tenant-owned Client and Project operations use verified
authentication context.

Organization onboarding beyond registration, audit logging, persistent refresh sessions, Project
frontend screens, Client portal Project access, milestones, files, invoices, and the other deferred
Project features described above remain unimplemented. Never commit `.env`; it can contain database
credentials, JWT secrets, and other environment-specific configuration.
