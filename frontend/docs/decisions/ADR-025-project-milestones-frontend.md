# ADR-025: Minimal Project Milestones Frontend

## Status

Accepted

## Context

Organization Admin users need a small Milestone interface within an existing Project. The API uses
nested Project routes and supports create, list, get, and update operations. Milestones contain a
title, optional description, optional due date, and one of three statuses. This capability must
remain part of Project Management rather than becoming a task-management product.

## Decision

Milestones are presented inside the parent Project experience. The Project detail page contains the
list, status filter, pagination, empty states, and Add Milestone action. No top-level Milestones
navigation item is added. Create, detail, and edit pages use routes nested below
`/projects/:projectId`, and every route remains inside the authenticated Organization Admin role
boundary. Client users and Super Admin users are not supported.

All requests reuse the existing authenticated API utility and configured `VITE_API_BASE_URL`.
Milestone records and credentials are not stored in browser storage. The frontend never sends
`tenantId`, and `projectId` appears only in the URL.

One reusable form supports create and edit. Creation hides status so the backend can apply
`pending`; editing allows `pending`, `in_progress`, and `completed`. Completion is only a status
update. Blank edit descriptions and due dates are sent as `null` to clear those optional values.

The due date uses the native HTML date input. API ISO values are converted by extracting and
validating their `YYYY-MM-DD` calendar portion, and selected dates are sent as UTC midnight
(`YYYY-MM-DDT00:00:00.000Z`). This explicit date-only round trip avoids visible timezone shifts.
Past dates remain valid, and no overdue state is calculated.

The list uses backend pagination with 20 records per page and an optional single status filter.
Abortable requests prevent a previous Project, page, or filter response from becoming current
after navigation. There is no DELETE behavior.

## Alternatives considered

A top-level Milestones area, global Milestone state, browser-storage caching, client-side
pagination, multi-select filters, a date-picker dependency, optimistic updates, and a separate
completion action were rejected because they add concepts not required by the backend or this
minimal Project workflow.

## Consequences

Organization Admin users can create, list, filter, view, edit, clear optional values, and change
Milestone status without leaving the Project context. No new dependency is installed. Milestones
are not a task-management system: tasks, assignments, comments, dependencies, reminders,
recurrence, progress, priorities, and activity feeds remain deferred. File delivery, invoices,
Client-user Milestone access, Super Admin management, and deletion also remain deferred.
