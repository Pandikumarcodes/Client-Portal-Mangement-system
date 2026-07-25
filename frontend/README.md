# Client Portal Frontend

This frontend uses React, Vite, React Router, native `fetch`, and React Context. Install and run
with `npm install`, `npm run dev`, `npm run build`, `npm run lint`, or `npm test`.

Set `VITE_API_BASE_URL` in `.env` (the example points to `http://localhost:5000/api/v1`). No secrets
belong in frontend environment variables. The API client always sends `credentials: 'include'` so
the HTTP-only refresh cookie participates in authentication.

`AuthProvider` bootstraps with `POST /auth/refresh`, keeps the access token in memory only, and
exposes the current user, organization, and role-aware route state. Protected routes use the
`Authorization: Bearer <access-token>` contract. Browser JavaScript never reads the refresh cookie.

Organization Admin Client Management is available at `/admin/clients`, with creation at
`/admin/clients/new` and view/edit at `/admin/clients/:clientId`. These routes are protected for
Organization Admin users only. The interface supports listing and paginating profiles, filtering by
active or inactive status, creating profiles, viewing details, editing details, and activating or
deactivating a profile.

Organization Admin Project Management is available at:

- `/projects` — paginated Project list with status and Client filters
- `/projects/new` — Project creation
- `/projects/:projectId` — Project details
- `/projects/:projectId/edit` — Project editing and status changes

All Project routes require an authenticated Organization Admin. Client and Super Admin users cannot
access these tenant Project screens, and the Projects navigation item is visible only to
Organization Admin users. The list uses backend pagination with 20 records per page and supports
the `active`, `on_hold`, `completed`, and `archived` statuses. The default unfiltered list can
include archived Projects.

Project creation requires selecting an existing Client and accepts a name plus an optional
description. New Projects receive the backend's default `active` status. Editing supports Client
reassignment, name, description, and status. Client choices are loaded through the existing
authenticated Client API with readable labels; Project rows keep only `clientId` and do not perform
per-row Client requests.

The Project API uses the same `VITE_API_BASE_URL` configuration and authenticated native Fetch
layer as the rest of the frontend. It never sends `tenantId`, and Project records are not stored in
browser storage. Project deletion is unsupported; archiving is a status update.

Organization Admin Project Milestones are integrated into `/projects/:projectId`. The Project
detail screen lists and paginates Milestones 20 at a time, supports one status filter, and links to:

- `/projects/:projectId/milestones/new` — create a Milestone
- `/projects/:projectId/milestones/:milestoneId` — view Milestone details
- `/projects/:projectId/milestones/:milestoneId/edit` — edit a Milestone

These routes require an authenticated Organization Admin and are not exposed to Client or Super
Admin users. There is no top-level Milestones navigation item. Supported fields are title,
optional description, optional due date, and—during editing—status. Status values are `pending`,
`in_progress`, and `completed`; creation leaves status to the backend's `pending` default.

Due dates use the native date input. A selected `YYYY-MM-DD` date is sent as UTC midnight, while an
API ISO value is displayed using its validated calendar-date portion so it does not visibly shift
with the browser timezone. Past dates are allowed. On edit, clearing description or due date sends
`null`; blank optional values are omitted during creation.

Milestone requests reuse `VITE_API_BASE_URL`, the authenticated API utility, in-memory access
tokens, refresh behavior, and safe error responses. They never send `tenantId` or place
`projectId` in request bodies, and Milestone records are not stored in browser storage. Milestone
deletion is unavailable. Tasks, assignments, comments, files, reminders, progress, invoices, and
Client-user Milestone access are not implemented.

Organization Admin Project Files are integrated into `/projects/:projectId`. The Project detail
screen lists Project deliverables with an Active, Archived, or All statuses filter and backend
pagination of 20 records per page. Files are reached only through a Project; no top-level Files
navigation item is provided. The nested routes are:

- `/projects/:projectId/files/new` — upload one file
- `/projects/:projectId/files/:fileId` — view safe file metadata and download
- `/projects/:projectId/files/:fileId/edit` — edit description and active/archived status

All File routes require an authenticated Organization Admin. Client and Super Admin users cannot
access them. Uploads reuse `VITE_API_BASE_URL` and the authenticated request utility, use a
multipart field named `file`, accept exactly one file per request, and allow an optional
500-character description. The browser supplies the multipart boundary. The frontend does not
manually set multipart `Content-Type`.

The upload size limit is 10 MiB. Accepted browser-reported MIME values are PDF, PNG, JPEG, plain
text, CSV, Word Open XML, and Excel Open XML. Frontend checks are usability validation only; the
backend remains authoritative. File status is `active` or `archived`. Archiving updates metadata
without deleting content, and archived files remain downloadable and can be restored to active.

Downloads use authenticated fetch rather than a public API link. A successful binary response is
read as a Blob, attached to a temporary object URL with a sanitized download filename, and then the
temporary anchor is removed and the object URL is revoked. Project File metadata, File objects,
Blobs, and object URLs are not persisted in browser storage. `tenantId`, generated stored names,
storage paths, and other storage internals are neither requested for display nor exposed in the
interface.

Public and signed links, deletion, file replacement, versioning, previews, thumbnails, Client-user
access, direct storage uploads, and cloud SDKs are not implemented.

Organization Admin Project Invoices are integrated into `/projects/:projectId`. The Project detail
screen lists Invoice records, filters by one status, and uses backend pagination with 20 records
per page. Invoices have no top-level navigation item and use these nested routes:

- `/projects/:projectId/invoices/new` — create an Invoice
- `/projects/:projectId/invoices/:invoiceId` — view Invoice details
- `/projects/:projectId/invoices/:invoiceId/edit` — edit an Invoice and manually change status

Every Invoice route requires an authenticated Organization Admin. Client and Super Admin users
cannot access these tenant screens. Supported fields are an Invoice number, amount, required issue
and due dates, and optional notes; status is available only while editing. Status values are
`draft`, `sent`, `paid`, and `void`. New records use the backend's `draft` default. Paid is a manual
record status and does not process a payment. Void keeps the Invoice record and is not deletion.
Invoice deletion is unavailable.

The backend money representation is integer `amountCents`. The controlled Amount (USD) input keeps
the user's decimal text while editing and converts it deterministically into cents on submission;
for example, `1250.00` becomes `125000`. It accepts at most two fractional digits and values from
one cent through 1,000,000,000 cents. API state is not converted permanently to floating-point
dollars. Amount display uses `en-US` USD currency formatting. USD is the only supported currency,
there is no currency selector, and no conversion is performed.

Issue and due dates use native date inputs and are sent as UTC-midnight ISO values. Both are
required, past dates are allowed, and the due date may equal but cannot precede the issue date.
No overdue state is calculated. Blank notes are omitted during creation; clearing notes during an
edit sends `null`.

Invoice requests reuse `VITE_API_BASE_URL`, the authenticated native Fetch utility, in-memory
access tokens, refresh behavior, and safe error handling. They use nested Project endpoints,
never send `tenantId`, never put `projectId` in request bodies, and do not store Invoice records or
drafts in browser storage. Status filtering omits the blank All statuses value and resets the page
to one.

Payment processing and providers, payment links or transactions, refunds, line items, products,
services, taxes, discounts, totals, PDFs, email delivery, recurring billing, automatic overdue
status, reminders, accounting exports, deletion, and Client-user Invoice access are not
implemented.

The Organization Admin Dashboard is available at `/dashboard`. It is protected by the existing
authentication restoration and Organization Admin role guard, appears as the first Organization
Admin navigation item, and is the Organization Admin destination after login and root-route
redirection. The existing `/admin` home remains available. Client and Super Admin users cannot
access or see navigation for this tenant Dashboard.

The Dashboard uses `GET /dashboard/organization` through the authenticated request utility and
configured `VITE_API_BASE_URL`. It submits no body, query parameters, or `tenantId`. Its five
sections show current-state counts for Clients, Projects, Milestones, Files, and Invoices. Links
lead to the existing Client and Project lists; Milestones, Files, and Invoices remain
Project-scoped and receive no top-level navigation.

The page shows a clear loading state, treats an all-zero response as valid structured data, maps
request failures to safe messages, and provides one retry action after an error. Requests are
aborted during cleanup. Dashboard results stay in page memory only and are never persisted in
localStorage, sessionStorage, or IndexedDB. There is no polling, background refresh, or caching.

The Dashboard contains no charts, monetary totals, percentages, trends, comparison periods,
overdue calculations, file-storage totals, recent activity, or reports. It does not invent Client
dashboard behavior, and Super Admin dashboard functionality remains deferred.

Deactivation is not deletion: inactive Client profiles remain stored and can be reactivated. The
backend enforces tenant ownership from the authenticated session, and the frontend never sends
`tenantId`. Creating a Client profile does not create a portal User account. Client invitations,
account linking, files, invoices, and other deferred business modules are not implemented.
