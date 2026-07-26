# Security guide

This portfolio MVP uses a modular Express backend, MongoDB shared collections, JWT access/refresh
tokens, and a React frontend. This guide describes implemented controls and known limitations; it
is not a production certification or compliance claim.

## Architecture and role boundaries

Organization is the tenant root. Organization Admin and Client identities require a `tenantId`;
Super Admin is platform-level and must not have one. Tenant management APIs currently allow
Organization Admin only. Super Admin uses dedicated `/api/v1/super-admin` routes and cannot inherit
tenant access. Client has no backend management access in the current repository.

Tenant context comes only from verified access-token identity. Never accept it from bodies, query
strings, route parameters, headers, or frontend state. Every tenant-owned query must include
`tenantId`. Project File and Invoice queries must also include `projectId`, and services must verify
the tenant-scoped Project before child lookup. Cross-tenant resources must look missing.

## Authentication and suspension

Access tokens last 15 minutes and refresh tokens seven days. Separate secrets, HS256, fixed
issuer/audience, and minimal claims are enforced. Access tokens are returned to the frontend and
kept only in React memory. Refresh tokens are sent only in the HTTP-only refresh cookie with
SameSite Lax, auth-route path scoping, a seven-day lifetime, and production-only Secure behavior.
Authentication responses are not cacheable.

Login and refresh check current User and Organization state. Composed tenant routes also load the
current Organization and reject suspended tenants. Reactivation permits normal access. Suspension
does not delete tenant data and does not revoke the cryptographic access token itself.

Refresh tokens are stateless and are not stored or hashed in MongoDB. A refresh response replaces
the browser cookie with a newly generated token, but the prior token is not recorded as consumed.
Logout clears the cookie but cannot invalidate a copied refresh token. Do not describe this as
server-side replay protection or global logout.

## Validation, DTOs, and errors

Module-owned strict Zod schemas reject unknown properties and empty PATCH bodies. Controllers use
`request.validated`; services and repositories allow-list mutable fields. DTOs explicitly select
public fields and exclude tenant IDs from tenant business/auth User responses, credentials, hashes,
tokens other than the approved access token, storage internals, Mongoose fields, and error causes.

Known application errors use the fixed error envelope. Unknown errors return a generic 500 without
stacks, database messages, paths, or causes in development or production responses. Request IDs are
available for correlation. X-Powered-By is disabled. Operational logs must never include passwords,
request bodies, tokens, cookies, Authorization headers, MongoDB URIs, or file content.

## Project Files

Uploads accept exactly one multipart field named `file`, at most 10 MiB. Allowed MIME values are
PDF, PNG, JPEG, plain text, CSV, Word Open XML, and Excel Open XML. HTML, JavaScript, SVG, archives,
and generic octet-stream uploads are rejected. Stored names are random; extensions come from the
approved MIME mapping; sanitized original names are display/download metadata only. Storage remains
under `PROJECT_FILE_STORAGE_ROOT`, is Git-ignored, and is never mounted through `express.static`.
Metadata persistence failure triggers a best-effort storage rollback.

Downloads require authentication, Organization Admin role, current active tenant context,
tenant-scoped Project ownership, and scoped File metadata. Content streams through the backend with
trusted stored MIME/size metadata, attachment-only Content-Disposition, sanitized filename handling,
and private no-store caching. No public, signed, or query-token URL exists. Archived files remain
downloadable by design.

MIME allowlisting is not content inspection. The MVP has no antivirus, malware sandbox,
content-disarm process, or file-signature verification. Treat uploaded content accordingly.

## Browser and local development

The frontend API origin comes from `VITE_API_BASE_URL`; no frontend environment variable should
contain a secret. API calls use relative paths, credentials include, and in-memory bearer tokens.
Do not place tokens, tenant records, File objects, Blobs, or object URLs in localStorage,
sessionStorage, IndexedDB, URLs, logs, or source. Downloads must revoke temporary object URLs.
Render server/user text through React text nodes, never raw HTML.

Keep local `.env` files untracked and use obvious placeholders in `.env.example`. Never commit real
MongoDB credentials or JWT secrets. Keep runtime storage ignored. Tests must remain offline and
must not start production listeners or contact real services.

## Known limitations

- Refresh-token replay is not detected, and logout is cookie clearing rather than server revocation.
- Access tokens are stateless; Organization suspension blocks composed tenant routes through a live
  lookup, but the token itself remains valid until expiry.
- MFA, password reset, email verification, OAuth, CAPTCHA, account lockout, and new rate-limiting
  infrastructure are absent.
- Antivirus, content scanning, file-signature sniffing, encryption-key management, SIEM, and
  external vulnerability scanning are absent.
- Local filesystem storage requires deployment-specific persistence, backup, and multi-instance
  planning.
- The local secret scan is heuristic and does not inspect Git history.
- The frontend contains Milestone UI/API code, but this repository has no backend Milestone module,
  so that workflow is not end-to-end functional.
- The frontend restores authentication on startup but does not automatically refresh and retry an
  arbitrary protected request after a 401; affected screens safely clear the session.

## Reporting issues

For this portfolio project, report a suspected security issue privately to the repository owner.
Include the affected route or file, reproduction conditions using non-production data, and impact.
Do not include real credentials, tokens, tenant data, or uploaded private files in a report.
