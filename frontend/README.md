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

Deactivation is not deletion: inactive Client profiles remain stored and can be reactivated. The
backend enforces tenant ownership from the authenticated session, and the frontend never sends
`tenantId`. Creating a Client profile does not create a portal User account. Client invitations,
account linking, files, invoices, and other deferred business modules are not implemented.
