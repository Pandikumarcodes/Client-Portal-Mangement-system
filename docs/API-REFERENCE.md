# API reference

Base path: `/api/v1`. JSON successes use `{ "success": true, "data": ... }`; safe failures use
`{ "success": false, "error": { "code", "message", "details"? } }`.

Protected routes require `Authorization: Bearer <access-token>`. All input schemas reject unknown
fields. Object IDs are 24-character hexadecimal strings. Paginated endpoints accept `page`
(default 1) and `limit` (default 20, maximum 50) and return `page`, `limit`, `total`, and
`totalPages`.

Common errors include `VALIDATION_ERROR` (400), `AUTHENTICATION_REQUIRED` (401), `FORBIDDEN` (403),
`ORGANIZATION_SUSPENDED` (403), `RESOURCE_NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), and
`INTERNAL_SERVER_ERROR` (500). Unsupported methods are not registered and return
`RESOURCE_NOT_FOUND`.

## 1. Health

### `GET /health`

- **Auth / role / tenant:** none
- **Input:** none
- **Success:** 200 when MongoDB is connected
- **Unavailable:** 503 when it is disconnected
- **Response:** service, environment, `healthy|unavailable`, `connected|disconnected`, and timestamp
- **Note:** combined application/database readiness signal; no separate liveness endpoint

## 2. Authentication

Authentication responses contain safe Organization metadata (or `null` for Super Admin), safe user
identity, and `accessToken`. They also set/rotate the refresh cookie. Authentication responses use
`Cache-Control: no-store`.

### `POST /auth/register`

- **Auth / role / tenant:** none
- **Body:** `organizationName` (2-120), kebab-case `organizationSlug` (2-80), `firstName`,
  `lastName`, email, and password (8-128 with lowercase, uppercase, and number)
- **Success:** 201; new active free Organization, active Organization Admin, and access token
- **Relevant errors:** `EMAIL_ALREADY_IN_USE`, `ORGANIZATION_SLUG_ALREADY_IN_USE` (409)
- **Note:** Organization and first admin are created transactionally

### `POST /auth/login`

- **Auth / role / tenant:** none
- **Body:** `{ "email": "...", "password": "..." }`
- **Success:** 200; identity, Organization/null, and access token
- **Relevant errors:** `INVALID_CREDENTIALS` (401), `ACCOUNT_SUSPENDED`,
  `ACCOUNT_NOT_ACTIVE`, `ORGANIZATION_SUSPENDED` (403)

### `POST /auth/refresh`

- **Auth:** refresh cookie required; no bearer token/body
- **Success:** 200; rotated refresh cookie and new access token
- **Relevant errors:** `AUTHENTICATION_REQUIRED` (401), account/Organization status errors (403)
- **Note:** cookie name is internal to the browser contract; it is HTTP-only, seven-day,
  `SameSite=Lax`, scoped to `/api/v1/auth`, and secure in production. Rotation does not include
  replay detection because refresh sessions are not persisted.

### `POST /auth/logout`

- **Auth:** no bearer token required
- **Success:** 204 with no body; clears refresh cookie
- **Note:** does not revoke already-issued access or refresh tokens server-side

## 3. Clients

All Client endpoints require Organization Admin authentication and active tenant context. Tenant ID
comes from the token; cross-tenant IDs return `CLIENT_NOT_FOUND`.

| Method/path | Input | Success | Response / relevant errors |
| --- | --- | --- | --- |
| `POST /clients` | Body: `firstName`, `lastName`, `email`, optional `companyName` | 201 | `{ client }`; `CLIENT_EMAIL_ALREADY_IN_USE` (409) |
| `GET /clients` | Query: pagination, optional `status=active|inactive` | 200 | `{ clients, pagination }` |
| `GET /clients/:clientId` | Client ID | 200 | `{ client }`; `CLIENT_NOT_FOUND` (404) |
| `PATCH /clients/:clientId` | At least one of name, email, nullable `companyName`, status | 200 | `{ client }`; not found/conflict |

Client DTO: `id`, names, email, nullable `companyName`, `status`, timestamps. There is no delete,
invitation, user-account creation, or Client-user access endpoint.

## 4. Projects

All Project endpoints require Organization Admin authentication and active tenant context. Project
DTOs omit tenant ID. Client selection/reassignment is verified within the same tenant.

| Method/path | Input | Success | Response / relevant errors |
| --- | --- | --- | --- |
| `POST /projects` | Body: `clientId`, name (2-150), optional description (max 2000) | 201 | `{ project }`; `CLIENT_NOT_FOUND` |
| `GET /projects` | Query: pagination, optional `status`, optional `clientId` | 200 | `{ projects, pagination }` |
| `GET /projects/:projectId` | Project ID | 200 | `{ project }`; `PROJECT_NOT_FOUND` |
| `PATCH /projects/:projectId` | At least one of clientId, name, nullable description, status | 200 | `{ project }`; project/client not found |

Statuses: `active`, `on_hold`, `completed`, `archived`. Archiving is an update; deletion is absent.

## 5. Milestones

No backend Milestone endpoint is implemented. Frontend Milestone routes/API helpers are incomplete
without a server contract and must not be presented as working end to end.

## 6. Project Files

Base path: `/projects/:projectId/files`. Every endpoint requires Organization Admin authentication,
active tenant context, and a tenant-scoped parent Project.

### `POST /projects/:projectId/files`

- **Body:** `multipart/form-data`, exactly one binary field named `file`, optional text
  `description` (max 500)
- **Maximum:** 10 MiB
- **Allowed declared MIME types:** `application/pdf`, `image/png`, `image/jpeg`, `text/plain`,
  `text/csv`, DOCX, XLSX
- **Success:** 201 `{ file }`
- **Errors:** `PROJECT_NOT_FOUND`, `PROJECT_FILE_REQUIRED` (400),
  `PROJECT_FILE_UPLOAD_INVALID` (400), `PROJECT_FILE_TOO_LARGE` (413),
  `PROJECT_FILE_TYPE_NOT_ALLOWED` (415)

### Collection and metadata operations

| Method/path | Input | Success | Response / relevant errors |
| --- | --- | --- | --- |
| `GET /projects/:projectId/files` | Pagination; optional `status=active|archived` | 200 | `{ files, pagination }` |
| `GET /projects/:projectId/files/:fileId` | IDs | 200 | `{ file }`; project/file not found |
| `PATCH /projects/:projectId/files/:fileId` | Nullable description and/or status | 200 | `{ file }`; project/file not found |

File DTO: `id`, `projectId`, original name, MIME, size, nullable description, status, timestamps.
Stored name and storage path are never returned.

### `GET /projects/:projectId/files/:fileId/download`

- **Success:** 200 binary stream with allowlisted content type, content length,
  `Content-Disposition: attachment`, and `Cache-Control: private, no-store`
- **Errors:** `PROJECT_NOT_FOUND`, `PROJECT_FILE_NOT_FOUND`,
  `PROJECT_FILE_CONTENT_NOT_FOUND`, or safe storage/internal error
- **Note:** archived files remain downloadable. There is no public/static URL or delete operation.
  MIME is allowlisted from upload metadata; content scanning is not implemented.

## 7. Invoices

Base path: `/projects/:projectId/invoices`. Every endpoint requires Organization Admin
authentication, active tenant context, and a tenant-scoped parent Project.

| Method/path | Input | Success | Response / relevant errors |
| --- | --- | --- | --- |
| `POST /projects/:projectId/invoices` | invoiceNumber, integer `amountCents`, issueDate, dueDate, optional notes | 201 | `{ invoice }`; project not found/date validation |
| `GET /projects/:projectId/invoices` | Pagination; optional status | 200 | `{ invoices, pagination }` |
| `GET /projects/:projectId/invoices/:invoiceId` | IDs | 200 | `{ invoice }`; project/invoice not found |
| `PATCH /projects/:projectId/invoices/:invoiceId` | At least one editable field, nullable notes | 200 | `{ invoice }`; not found/date validation |

`amountCents` is an integer from 1 through 1,000,000,000. Currency is always `USD`. Issue/due dates
accept ISO dates/datetimes, and due date cannot precede issue date. Statuses are `draft`, `sent`,
`paid`, and `void`; paid is manual metadata and void is not deletion. No payment, PDF, tax, line
item, email, or delete endpoint exists.

## 8. Organization dashboard

### `GET /dashboard/organization`

- **Role/auth/tenant:** Organization Admin; bearer token; active tenant required
- **Input:** none
- **Success:** 200 `{ dashboard }` with current counts:
  - Clients: total, active, inactive
  - Projects: total, active, onHold, completed, archived
  - Milestones: all zero (backend module absent)
  - Files: total, active, archived
  - Invoices: total, draft, sent, paid, void
- **Notes:** private no-store response; no filters, trends, revenue, or tenant ID

## 9. Super Admin

All endpoints require a Super Admin bearer token. Organization Admin and Client receive
`FORBIDDEN`. They expose no Client, Project, File, Invoice, password, token, or refresh-session data.

| Method/path | Input | Success | Response / relevant errors |
| --- | --- | --- | --- |
| `GET /super-admin/overview` | none | 200 | Organization active/suspended and tenant-user role counts |
| `GET /super-admin/organizations` | Pagination; optional `status=active|suspended` | 200 | `{ organizations, pagination }` |
| `GET /super-admin/organizations/:organizationId` | Organization ID | 200 | safe Organization fields and user counts; `ORGANIZATION_NOT_FOUND` |
| `PATCH /super-admin/organizations/:organizationId/status` | `{ "status": "active" }` or suspended | 200 | updated safe Organization; not found |
| `GET /super-admin/organizations/:organizationId/users` | Pagination; optional role/status | 200 | safe non-Super-Admin users and pagination; not found |

User role filter: `organization_admin|client`. User status filter:
`active|invited|suspended`. No Organization/user deletion, creation, mutation, impersonation, or
tenant-record endpoint is implemented.

