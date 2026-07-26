# Title

Security hardening and full MVP integration testing

# Status

Accepted

# Context

The repository contains authentication, three roles, tenant-owned Clients, Projects, Project Files,
Invoices, an Organization Dashboard, Super Admin oversight, Organization suspension, and a
role-aware React frontend. Prompt 30D requires security hardening without new product capabilities
or external security infrastructure. The repository has no backend Milestone module even though
the frontend contains Milestone screens, so Milestones are not an implemented end-to-end module.

# Decision

The review applies deny-by-default authorization. Public authentication and health routes remain
separate from protected routes. Organization Admin tenant routes reject unauthenticated, Client,
and Super Admin identities. Super Admin platform routes reject tenant roles and never imply tenant
business-data access. Client has only its existing frontend landing route and no backend business
management API.

Tenant identity comes only from verified access-token context. Every Client and Project repository
filter contains `tenantId`; Project File and Invoice filters contain `tenantId`, `projectId`, and
the child ID. Services verify the tenant-scoped Project before child lookup. Cross-tenant records use
the same not-found contracts as absent records. Dashboard counts use explicit `tenantId` filters.

Access and refresh JWTs retain separate secrets, HS256, fixed issuer/audience, 15-minute and
seven-day lifetimes, and minimal identity claims. Refresh cookies remain HTTP-only, SameSite Lax,
restricted to `/api/v1/auth`, seven days, and Secure only in production. Authentication responses
are `Cache-Control: no-store` with `Pragma: no-cache`. Access tokens stay in React memory. Refresh
tokens remain cookie-only and are not returned in JSON or stored in MongoDB.

Refresh produces a new token with a new `jti`, but there is no persisted refresh-session state.
Consequently, a copied earlier refresh token is not server-revoked by rotation, and logout clears
the browser cookie without invalidating a copied token. Adding session management or a token
blacklist is outside this decision. Access tokens are stateless and are not cryptographically
revoked.

Login and refresh load current User and Organization state. Tenant route composition now performs
one current Organization lookup after access-token authentication and role checking. Suspended
Organizations receive `ORGANIZATION_SUSPENDED`; a missing Organization invalidates the tenant
context. Super Admin routes do not run the tenant lookup. Reactivation restores tenant-route access.

All request schemas remain strict, reject unknown fields, and reject empty updates. Controllers use
`request.validated`; services and repositories use field allow-lists. The Client repository update
boundary was changed from a deny-list copy to an explicit mutable-field allow-list. Response DTOs
explicitly map safe fields. Tenant IDs were removed from authentication User DTOs; only the trusted
internal token identity retains tenant context. Password hashes, refresh tokens, storage names,
storage paths, Mongoose internals, stacks, causes, and driver errors remain excluded.

The centralized error handler preserves safe `ApiError` fields and maps unknown failures to a
generic response. Request IDs remain response headers, X-Powered-By remains disabled, and structured
logs avoid bodies, authorization headers, cookies, tokens, and error messages.

Project File upload remains one `file` field, 10 MiB maximum, with an explicit MIME allowlist.
HTML, JavaScript, SVG, archives, and octet-stream are excluded. Temporary and stored names are
random, extensions come from trusted MIME mapping, original display names are sanitized, storage
paths are constrained beneath the configured non-root storage directory, runtime data is ignored,
and metadata failures attempt content rollback.

Project File downloads remain authenticated Organization Admin routes. Project ownership is checked
before the `{ tenantId, projectId, fileId }` metadata lookup. Downloads stream from private storage,
use trusted MIME/size metadata, force an attachment with CRLF-safe names, and send
`Cache-Control: private, no-store`. Missing metadata, missing content, and invalid storage paths use
safe errors without exposing paths.

The frontend keeps access tokens and records in component/context memory only. No localStorage,
sessionStorage, IndexedDB, query-token, `window.open`, or HTML injection path is used. Role route
guards and navigation are defense in depth; backend checks remain authoritative. Blob downloads use
authenticated fetch, sanitized filenames, temporary anchors, and immediate object-URL revocation.
The API client now rejects absolute and scheme-relative request targets so credentials and bearer
tokens cannot be redirected to an arbitrary origin. Suspended refresh restoration shows a fixed
safe message rather than server-provided text.

Offline integration tests use focused Express applications, Supertest, dependency injection,
in-memory repository behavior, Mongoose validation where already established, and temporary local
directories. They do not contact MongoDB, DNS, cloud storage, email, or external services. A local
tracked-file text scan checks common credential markers without an external scanner.

# Alternatives considered

A broad authentication rewrite, persistent refresh sessions, Redis, token blacklists, MFA, password
reset, email verification, OAuth, antivirus, MIME-sniffing dependencies, external scanners, SIEM,
deployment changes, and new business modules were rejected as outside Prompt 30D. Granting Super
Admin implicit tenant access was rejected because platform oversight and tenant authority are
separate. Implementing the missing Milestone backend was rejected because that would add a business
module.

# Consequences

Current Organization suspension is enforced at login, refresh, and each composed tenant request
without blocking Super Admin. Tenant and child-resource boundaries have focused cross-module
regression coverage. Authentication data is non-cacheable, auth User DTOs expose less internal
context, Client updates are allow-listed twice, and frontend credential forwarding is origin-bound.
No new dependency was introduced.

Residual limitations remain: copied refresh tokens survive rotation/logout until expiry; access
tokens remain stateless; there is no MFA, password reset, email verification, antivirus, content
scanning, or malware sandbox; MIME allowlisting trusts browser-reported metadata and is not content
verification; local file storage has deployment, backup, and multi-instance limits; the source scan
is heuristic and not history scanning; and frontend Milestone calls have no backend implementation.
This decision is not a production certification or compliance assessment.
