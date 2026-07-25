# Title

Basic Organization Admin Dashboard frontend

# Status

Accepted

# Context

Organization Admins need a minimal current-state view of tenant-owned Clients, Projects,
Milestones, Project Files, and Invoices. The backend provides the read-only, tenant-scoped
`GET /api/v1/dashboard/organization` endpoint from Prompt 30A. The frontend must use the existing
authentication, role authorization, request, routing, navigation, styling, and error boundaries
without creating an analytics product or exposing tenant selection.

# Decision

The Dashboard is available at `/dashboard` only to authenticated Organization Admin users. The
existing protected route and Organization Admin role guard enforce the frontend boundary; backend
authorization remains authoritative. Client and Super Admin users are redirected to their existing
role homes and do not see the Dashboard navigation item.

The Organization Admin role home changes from `/admin` to `/dashboard`, so successful login,
authenticated public-route redirection, and root redirection now open the current-state overview.
The existing `/admin` route and Home navigation item remain available, while Client and Super Admin
redirect behavior remains unchanged.

The Dashboard API module calls `GET /dashboard/organization` through the existing authenticated
native Fetch request utility and configured `VITE_API_BASE_URL`. It sends no body, query
parameters, or `tenantId`. Safe backend errors propagate. A focused normalizer accepts only the
five approved sections and their approved count keys, defaults missing approved fields to zero
only within a structurally valid dashboard response, and rejects present values that are not
finite, non-negative integers. Arbitrary keys, repository internals, and an unexpected `tenantId`
are discarded.

The page shows Clients, Projects, Milestones, Files, and Invoices as semantic count sections. Each
contains a total and the statuses returned by the backend contract. Client and Project actions link
to their existing lists. Milestones, Files, and Invoices remain Project-scoped, so no top-level
routes or navigation items are created for them.

Dashboard state remains local to the mounted page. The initial request is abortable, stale
responses cannot replace a newer request, authentication failures use the existing session
recovery behavior, other failures render safe messages, and an error-only Retry button issues one
new request while duplicate retries are blocked. An all-zero response remains valid. Dashboard data
is not persisted in browser storage, cached, polled, or automatically refreshed.

The interface uses no charts. It calculates no trends, percentages, comparisons, Invoice monetary
totals, revenue, overdue state, Project or Milestone progress, or Project File storage totals. The
frontend does not invent a Client dashboard because Prompt 30A deferred the required secure Client
profile relationship. Super Admin dashboard behavior remains deferred to Prompt 30C. No new
frontend dependency is introduced.

# Alternatives considered

Keeping `/admin` as the Organization Admin post-login destination was considered, but the existing
single role-home helper makes `/dashboard` a safe, consistent destination without weakening route
guards or changing other roles. Replacing `/admin` was rejected to preserve existing routes and
navigation. Top-level Milestone, File, or Invoice screens were rejected because those resources
remain Project-scoped. Client-side aggregation, global Dashboard context, browser-storage
persistence, polling, caching, charts, analytics libraries, and configurable widgets were rejected
because they exceed the current-state backend contract and MVP scope.

# Consequences

Organization Admins receive a responsive, accessible overview immediately after login and can move
to the existing Client or Project workflows. The frontend exposes only approved integer counts and
never selects or displays a tenant. Direct navigation and refresh continue to use authentication
restoration. Client and Super Admin behavior remains isolated. Historical analysis, financial
summaries, storage reporting, Client dashboards, and Super Admin dashboards require separate
approved backend and frontend decisions.
