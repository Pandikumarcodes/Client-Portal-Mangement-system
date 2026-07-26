# Portfolio and interview handoff

## 1. One-line description

A tested React/Express multi-tenant Client Management Portal with role-separated administration,
tenant-scoped MongoDB access, authenticated file delivery, Invoices, and deployment documentation.

## 2. GitHub repository description

Multi-tenant React + Express client portal with secure file delivery, Invoices, RBAC, MongoDB, and
automated security tests.

## 3. Resume bullets

- Designed a modular-monolith Node.js/Express API and React SPA for tenant-scoped Client, Project,
  Project File, Invoice, and dashboard workflows.
- Implemented JWT access authentication with rotating HTTP-only refresh cookies, role guards, and
  live Organization suspension checks.
- Secured multi-tenant persistence through trusted token context, tenant-scoped repositories,
  parent-resource verification, strict Zod schemas, update allowlists, and safe DTOs.
- Built authenticated file upload/download with MIME/size constraints, randomized private storage
  names, metadata rollback, and persistent-volume deployment guidance.
- Modeled USD Invoice amounts as integer cents and separated manual record statuses from payment
  behavior.
- Tested backend/frontend layers and security boundaries, then documented local setup, API,
  architecture, deployment, troubleshooting, demo, and manual verification.

## 4. LinkedIn project description

I built a full-stack Client Management Portal for multiple Organizations using React, Vite,
Express, MongoDB/Mongoose, and Zod. Organization Admins manage Clients, Projects, protected Project
Files, Invoices, and operational counts; a separate Super Admin surface handles limited Organization
oversight without tenant-record access. The implementation emphasizes tenant-scoped queries,
explicit role boundaries, safe DTOs, in-memory access tokens, HTTP-only refresh cookies, structured
request logging, and layered offline tests. I also prepared provider-neutral deployment,
persistent-storage, manual QA, and demo documentation. The MVP intentionally excludes payments,
Client business workflows, malware scanning, and end-to-end Milestones.

## 5. Two-minute interview answer

I built a multi-tenant Client Management Portal as a modular monolith. An Organization Admin can
manage Clients and Projects, deliver files through authenticated routes, record USD Invoices, and
see current count summaries. A platform Super Admin can inspect safe Organization/user metadata and
suspend Organizations but cannot access tenant business records.

The central problem was authorization, not just CRUD. Tenant ID comes from the verified JWT rather
than input. Each tenant-owned repository query includes it, and Project child resources additionally
verify the tenant-scoped parent. Zod rejects unknown fields, services construct update allowlists,
and DTOs omit tenant/storage/security internals.

Access tokens stay in React memory. Refresh tokens use an HTTP-only cookie and rotate. Project File
bytes live in private filesystem storage while MongoDB holds metadata; downloads always cross the
authorization boundary. Vitest/Supertest and frontend component/API tests cover the layers, with
specific integration matrices for authorization, mass assignment, and tenant isolation. I document
the trade-offs honestly: persistent storage is required, access tokens are stateless, Client and
Milestone workflows are incomplete, and there is no malware scanning or payment processing.

## 6. Five-minute architecture answer

Start with the browser and trace a request. A React page calls a feature API module, which uses one
Fetch client configured with a build-time API base, included credentials, and an in-memory bearer
token. The backend route composes authentication, role, live Organization status, and Zod
validation. The controller only translates HTTP. The service verifies ownership and business
rules, creates safe DTOs, and calls a repository. The repository scopes MongoDB operations, and the
Mongoose model supplies persistence invariants/indexes.

This is a modular monolith because the domains need clean boundaries but not independent scaling or
distributed transactions. Organization is the tenant root. Super Admin is platform-level and has no
tenant ID, so platform routes have a separate authorization chain and safe projections.

Authentication uses short-lived access tokens and seven-day refresh cookies. Refresh reloads current
user/Organization state and rotates the cookie. Logout clears it but cannot revoke it server-side
because sessions are not persisted. Tenant routes query current Organization status, so suspension
is enforced even when an access token has not expired.

Files use a storage adapter: temporary upload, random stored name, private volume, MongoDB metadata,
best-effort rollback, and authenticated streaming. Invoices persist integer cents and fixed USD.
Dashboard counts use tenant-scoped `countDocuments`. Tests inject repositories/storage/token
boundaries for offline speed and include integration-level security coverage.

Production topology is a static HTTPS SPA, HTTPS Node API, Atlas, and persistent private volume.
The volume prevents naive horizontal scaling; the next storage step would be an object-storage
adapter with the same service contract.

## 7. Difficult problems solved

- Enforcing tenant ownership consistently across direct and Project-child resources
- Keeping platform oversight separate from tenant management
- Rotating refresh credentials while restoring a memory-only browser session
- Streaming protected files without exposing storage paths or static URLs
- Coordinating file persistence and metadata rollback
- Preserving exact money values across USD text input and integer API state
- Testing layered behavior without requiring live Atlas in most tests
- Documenting incomplete frontend Milestone artifacts without overstating MVP scope

## 8. Security decisions

- Trusted `tenantId` only from verified identity
- Same not-found behavior for absent and cross-tenant resources
- Explicit role middleware at every protected route group
- Strict schemas, normalized validated input, field allowlists, safe DTOs
- HTTP-only refresh cookie; access token in memory only
- Exact-origin credentialed CORS
- Private generated file paths and authenticated no-store downloads
- Safe centralized errors and structured redacted logging
- Live Organization suspension checks on tenant requests

## 9. Testing strategy

Backend tests cover configuration, diagnostics, models, validation, repositories, services,
controllers, routes, middleware, file storage, server lifecycle, and app composition. Focused
integration suites cover authorization matrix, mass assignment, and two-tenant isolation. Frontend
tests cover Fetch contracts, normalization/formatting, forms/components, page states, routing, and
role behavior under jsdom. Dependency injection/mocks make the suite offline and deterministic;
manual Atlas/browser/storage checks remain necessary.

## 10. Trade-offs

- Modular monolith over microservices for MVP operational simplicity
- Filesystem adapter over object storage for implementation scope
- Stateless access tokens over immediate general revocation
- Live database status check over cached suspension
- Current database counts over analytics infrastructure
- MIME declaration allowlist over full content scanning
- Provider-neutral deployment documentation over unverified vendor files

## 11. Future improvements

Implement the missing backend Milestone module before presenting Milestones; migrate the storage
adapter to private object storage; persist refresh sessions for replay detection/revocation; add
rate limiting, MFA/account recovery, and file content scanning; separate readiness/liveness; and
measure query/index behavior before making scale claims.

## 12. Likely interview questions and suggested answers

### Why a modular monolith?

One deployment and database fit the MVP while module boundaries preserve maintainability. It avoids
distributed failure and consistency costs before independent scaling is demonstrated.

### How is tenant isolation enforced?

The verified access token supplies tenant ID; request schemas never accept it. Repositories include
it in every tenant query, services verify tenant-scoped parents, and DTOs omit it. Cross-tenant IDs
look absent.

### Why services and repositories?

Services keep business/ownership rules independent of HTTP and persistence; repositories centralize
query scoping. This creates injectable seams for offline tests and prevents controllers from
bypassing rules.

### Why integer cents?

Binary floating-point dollars can introduce rounding ambiguity. The API persists exact cents, and
the frontend performs deterministic decimal-string conversion.

### Why local filesystem storage?

It met MVP scope and enabled a small adapter with protected streaming. It is explicitly a deployment
constraint, not a horizontal-scale design.

### How would you migrate to object storage?

Implement the existing storage operations against a private bucket, stream through the authorized
route or issue very short-lived post-authorization delivery, migrate binaries with checksums, update
metadata only after verification, and run a reversible dual-read migration.

### How does refresh rotation work?

Refresh verifies the HTTP-only cookie, reloads current identity/Organization, then issues a new
access and refresh token. Because sessions are not persisted, old-token replay is not detected.

### Why can stateless access tokens remain valid after suspension?

Their signature/expiry are self-contained. Current tenant middleware mitigates this by checking live
Organization status per tenant request, but cryptographic revocation would require state/key
strategy.

### How are cross-tenant resources hidden?

Queries combine tenant ID with record ID (and Project ID for children), returning the normal
not-found result when no scoped record matches.

### Why is Super Admin separate?

Platform oversight does not imply tenant data access. Separate routes, token shape, role guards, and
DTO projections make that boundary explicit.

### How do offline tests work?

Layer dependencies are injectable, HTTP is tested with Supertest, browser Fetch is mocked, and
models/schemas can be validated without connecting to Atlas. A smaller manual plan verifies real
infrastructure.

### What would you build next?

Close the current incompleteness first: backend Milestones or remove that UI from a release. Then
object storage and refresh-session revocation, based on product/risk priorities.

## 13. Demo evidence checklist

- [ ] Root README and documentation links render.
- [ ] Exact validation command output and test counts are recorded.
- [ ] Architecture and relationship diagrams are ready.
- [ ] Fictional two-tenant data exists.
- [ ] Protected File upload/download evidence is ready.
- [ ] Super Admin denial and suspension evidence is ready.
- [ ] Browser storage/log redaction inspection is ready.
- [ ] Screenshots/recording omit credentials and personal data.
- [ ] Known limitations slide/note is ready.
- [ ] Offline fallback pack is ready.

