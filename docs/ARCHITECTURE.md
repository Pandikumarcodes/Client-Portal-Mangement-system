# Architecture

## 1. System context

Organization Admins use a React SPA to manage one Organization's operational records. Client users
can authenticate but have no business-record workflows. Super Admins use a separate platform
surface for Organization status and safe tenant-user oversight. Express exposes the API, MongoDB
stores identities and metadata, and a private filesystem stores Project File binaries.

```text
Organization Admin / Client / Super Admin
                  |
             React SPA
                  |
          HTTPS JSON + multipart
                  |
        Express modular monolith
          |                 |
       MongoDB       persistent private volume
```

## 2. Why a modular monolith

One backend process and database keep MVP deployment and transactions understandable, while domain
folders preserve boundaries that can evolve independently. This avoids premature network,
observability, consistency, and operational costs of microservices without collapsing all logic
into routes. Modules share cross-cutting authentication, validation, errors, and logging.

## 3. Backend layering

```text
Route
 -> authentication middleware
 -> role middleware
 -> active tenant middleware (tenant routes)
 -> validation middleware
 -> controller
 -> service
 -> repository
 -> model
 -> MongoDB
```

- **Route:** URL and middleware composition.
- **Validation middleware:** Zod parses only declared sections into frozen `request.validated`.
- **Controller:** translates validated HTTP input into service calls and safe HTTP responses.
- **Service:** owns business rules, parent/ownership verification, update allowlists, and DTOs.
- **Repository:** performs persistence and tenant-scoped queries.
- **Model:** defines data shape, validation, timestamps, and indexes.

Repositories do not authorize roles because they do not receive an authenticated HTTP principal.
Controllers do not access models because persistence details and ownership checks belong behind
services/repositories.

## 4. Frontend layering

```text
React page
 -> domain feature API module
 -> apiRequest (relative path, credentials included, bearer token)
 -> backend API
 -> response contract normalization
 -> component-local state
```

React Router and role-aware navigation improve UX; backend controls remain authoritative. React
Context holds authentication state and the access token in memory. Pages model loading, empty,
error, and success states; records are not persisted in browser storage.

## 5. Authentication architecture

Registration creates the Organization and first Organization Admin in one transaction. Login
verifies a bcrypt hash and returns a 15-minute HS256 access token in JSON plus a seven-day HS256
refresh token in a cookie. The cookie is HTTP-only, `SameSite=Lax`, scoped to `/api/v1/auth`, and
`Secure` when `NODE_ENV=production`.

`POST /auth/refresh` verifies the cookie, reloads the user and Organization, and issues both tokens
again (rotation). Tokens contain minimal identity claims. Super Admin tokens omit `tenantId`;
tenant-user tokens require it. Logout clears the browser cookie, but there is no persistent refresh
session, server-side revocation, or replay detection.

Access tokens are stateless and remain cryptographically valid until expiry. Current composed tenant
routes additionally reload the Organization and reject suspended tenants; login and refresh do the
same. This does not provide general token revocation.

## 6. Authorization architecture

`authenticateRequest` validates the bearer token. `requireRoles` checks a fixed role allowlist.
Tenant routes then require a tenant context and a currently active Organization. Organization
Admin-only routes cover Clients, Projects, Files, Invoices, and the dashboard. Client has only a
frontend home route. Super Admin uses dedicated platform routes without tenant authorization.

## 7. Tenant isolation

- `tenantId` comes only from `request.auth`.
- Schemas do not accept `tenantId`.
- Tenant-owned repository queries include `tenantId`.
- Project-child File and Invoice queries also include `projectId`.
- Services verify a tenant-scoped parent Project before child operations.
- Cross-tenant IDs return the same not-found response as absent IDs.
- DTOs omit `tenantId`, storage paths, and password/token data.
- Super Admin platform routes never imply access to tenant business repositories.

## 8. Platform versus tenant routes

Tenant routes live under `/clients`, `/projects`, and `/dashboard` and compose authentication,
Organization Admin authorization, and active tenant checks. `/super-admin` routes compose
authentication and `super_admin` authorization only. They return Organization metadata, counts,
and safe tenant-user identity fields, not Clients, Projects, Files, or Invoices.

## 9. Data relationships

```text
Organization
|-- Users (Organization Admin or Client identity)
|-- Client profiles
|   `-- Projects
|       |-- Project Files (metadata -> private binary)
|       `-- Invoices

Platform
`-- Super Admin Users (no tenantId)
```

Client profile and Client authentication identity are separate. An optional `Client.userId` exists
for future linking but no secure ownership workflow uses it. There is no backend Milestone model.

## 10. Project-child resources

Files and Invoices are nested below `/projects/:projectId`. Their service first checks that the
Project exists for the authenticated tenant, then queries the child with both `tenantId` and
`projectId`. Project creation and reassignment similarly verify the selected Client inside the
tenant.

## 11. Project File storage

MongoDB stores safe metadata plus private `storedName`/`storagePath`; the filesystem stores bytes.
Multer accepts one `file` part up to 10 MiB and allowlists PDF, PNG, JPEG, text, CSV, DOCX, and XLSX
declared MIME types. Generated random names avoid trusting the original filename.

Uploads first land under a private `.tmp` directory, move to a generated stored name, then create
metadata. If metadata persistence fails, the stored file is removed best-effort. Downloads verify
authentication, role, live tenant status, Project ownership, and File ownership before streaming
with attachment and no-store headers. No upload directory is mounted with `express.static`.

Production requires a persistent writable volume. Database backups without binaries, or binary
backups without metadata, are incomplete. MIME allowlisting is not content inspection; antivirus is
not implemented.

## 12. Invoice money

Invoices persist `amountCents` as an integer from 1 through 1,000,000,000 and fixed currency `USD`.
This avoids floating-point dollar persistence. The frontend deterministically converts a two-decimal
USD string to cents. There are no line items, tax, discounts, payment processing, or automatic
overdue state.

## 13. Dashboard counts

The Organization Admin dashboard issues explicit tenant-scoped `countDocuments` queries for current
Client, Project, File, and Invoice totals and statuses. It does not load records, cache results,
calculate trends, or sum money. Milestone totals and statuses are always zero because no backend
module exists.

## 14. Super Admin architecture

Super Admin can read platform counts, paginate/filter Organizations, read safe Organization details
and tenant-user lists, and change Organization status between `active` and `suspended`. DTOs omit
Organization plan, password hashes, refresh data, and tenant business records. Super Admin users are
excluded from tenant-user queries. There is no deletion, impersonation, user mutation, or tenant
record access.

## 15. Errors

Expected failures use `ApiError`; centralized middleware returns:

```json
{
  "success": false,
  "error": {
    "code": "SAFE_CODE",
    "message": "Safe message."
  }
}
```

Validation adds bounded field details. Unknown failures become
`INTERNAL_SERVER_ERROR` without stacks, infrastructure messages, or secrets. Unknown routes return
`RESOURCE_NOT_FOUND`.

## 16. Logging and correlation

Request-ID middleware accepts a valid `X-Request-Id` or creates a UUID. AsyncLocalStorage carries the
ID; Pino emits structured completion logs to stdout/stderr. Logs include safe request metadata and
exclude bodies, queries, credentials, authorization, cookies, tokens, MongoDB URIs, and uploaded
content. Platform log retention and shipping are deployment responsibilities.

## 17. Test architecture

Backend Vitest tests cover configuration, diagnostics, models, schemas, repositories, services,
controllers, routes, middleware, storage, and lifecycle. Supertest covers HTTP composition.
Dedicated integration tests exercise the authorization matrix, mass assignment, and tenant
isolation. Dependencies are injected at module boundaries, so most tests run offline without a
MongoDB server.

Frontend Vitest/jsdom tests cover API modules, normalization and formatting utilities, forms,
components, pages, route roles, and failure states. Fetch and browser APIs are mocked. These tests
validate contracts offline; they do not replace a real Atlas/browser walkthrough.

## 18. Deployment topology

```text
Browser
 -> HTTPS static host (dist + SPA fallback)
 -> HTTPS Node API
      |-> MongoDB Atlas over TLS/SRV
      `-> mounted private persistent Project File volume
```

The API connects to MongoDB before listening. Its health route reports database readiness. Signals
close the listener and disconnect Mongoose.

## 19. Major trade-offs

- Modular monolith favors deployment simplicity over independent module scaling.
- Filesystem storage is simple and protected but requires one persistent/shared volume.
- Stateless access tokens avoid per-request session storage but limit immediate revocation.
- Live Organization checks improve suspension enforcement at the cost of a database read per tenant
  request.
- Current-state counts remain accurate but can become query-heavy as data grows.
- Declared MIME allowlisting is low complexity but does not prove file contents are safe.
- One combined health check is useful for readiness but unsuitable as an independent liveness signal.

## 20. Deferred architecture

Object storage, CDN-backed protected delivery, persistent refresh sessions, job queues, distributed
caches, WebSockets, microservices, advanced observability, malware scanning, and the backend
Milestone module are intentionally deferred.

