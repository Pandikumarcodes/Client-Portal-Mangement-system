# ADR-022: Minimal Tenant-Scoped Project Model and API

## Status

Accepted

## Context

Organization Admin users need to manage delivery Projects for existing Client profiles. Projects
must remain isolated by Organization, must not reveal tenant ownership through HTTP responses, and
must begin with a deliberately small persistence and API surface.

## Decision

Projects are tenant-owned records, and every Project belongs to exactly one Client. Before creating a
Project or reassigning its `clientId`, the service verifies the Client through a lookup containing
both `tenantId` and `clientId`. A missing Client and a Client owned by another tenant produce the same
safe `CLIENT_NOT_FOUND` response.

The initial Project fields are only `tenantId`, `clientId`, `name`, optional `description`, and
`status`, plus Mongoose timestamps. Supported statuses are `active`, `on_hold`, `completed`, and
`archived`. Project names are not unique. Archiving is an ordinary status update rather than hard
deletion, and archived Projects remain stored.

Authenticated Organization Admin users may create, list, get, and update Projects under
`/api/v1/projects`. Super Admin and Client users do not use these tenant Project routes. Tenant
context comes only from `request.auth.tenantId`, and every Project repository filter includes it.
Responses use explicit safe Project DTOs that omit `tenantId`.

List operations use newest-first ordering, page/limit pagination, and optional status and Client
filters. Routes follow the existing schema, controller, service, and repository boundaries.

## Alternatives considered

Hard deletion was rejected because status changes preserve records and provide sufficient lifecycle
control for this increment. Globally or tenant-unique Project names were rejected because different
Projects may legitimately share a name. Client access and Super Admin management were deferred
because neither role belongs in the initial Organization Admin workflow.

Adding dates, budgets, currency, progress, milestones, files, invoices, team assignment, comments,
activity, or search was deferred to keep the model and API minimal.

## Consequences

Organization Admin users can manage a small tenant-isolated Project record tied to an existing
tenant-owned Client. Archived Projects remain queryable and can be filtered by status. The API has no
DELETE operation.

Project frontend screens, Client portal access, milestones, dates, budgets, progress, files,
invoices, comments, activity feeds, notifications, and audit logging remain unimplemented.
