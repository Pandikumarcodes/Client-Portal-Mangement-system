# ADR-023: Minimal Project Management Frontend

## Status

Accepted

## Context

Organization Admin users need a small frontend for managing tenant-scoped Projects that belong to
existing Client profiles. The backend already exposes authenticated create, list, get, and update
operations. Project DTOs contain `clientId` rather than a populated Client, while the interface must
show readable Client labels and preserve the existing authentication, routing, request, and styling
boundaries.

## Decision

Project Management routes are available only to authenticated Organization Admin users. Project
data comes from the tenant-scoped backend through the existing native Fetch authenticated API
layer. The frontend never supplies `tenantId` and never persists Project records in browser
storage.

The Project list uses backend page/limit pagination with 20 records per page and supports status and
Client filters. Client records are loaded once per Project screen with the largest backend-supported
page size needed by this minimal interface. The resulting collection supplies both select options
and a deterministic `clientId` to readable-label map, avoiding per-row Client requests and N+1
traffic. Unresolved Client IDs use a neutral fallback.

A reusable Project form supports creation and editing. Creation requires a Client and name, accepts
an optional description, and does not expose status because the backend creates Projects as active.
Editing supports Client, name, description, and the four status values: active, on hold, completed,
and archived. A blank edit description is sent as `null` to use the backend clearing contract.
Archiving is an ordinary status update rather than deletion.

Milestones, files, invoices, budgets, dates, progress, team members, Client-user Project access, and
Super Admin Project management are deferred. No new dependency is introduced.

## Alternatives considered

Populating or fetching one Client for every Project row was rejected because it creates N+1
requests. A second Project-specific Client API was rejected in favor of the existing Client list
function. Client-side pagination, global Project state, browser-storage caching, third-party form or
data-fetching libraries, a separate archive endpoint, and deletion were rejected because the
backend and current scope do not require them.

## Consequences

Organization Admin users can list, filter, create, view, edit, and archive Projects while retaining
the current authentication restoration and API error behavior. Client labels are bounded by the
loaded Client collection, so a record outside that collection appears as “Client unavailable”
rather than exposing a raw identifier. Archived Projects remain stored and viewable. Deferred
Project capabilities require a later approved decision and implementation prompt.
