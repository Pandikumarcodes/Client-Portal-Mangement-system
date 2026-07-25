# ADR-020: Minimal Tenant-Scoped Client CRUD API

## Status

Accepted

## Context

Organizations need a small API for managing business-customer Client profiles. The API must preserve
tenant isolation and keep Client profiles separate from User authentication identities.

## Decision

Expose create, list, get, and update operations under `/api/v1/clients`, restricted to authenticated
Organization Admin users. Every route applies authentication, role authorization, and tenant context
guards. The tenant ID comes only from verified `request.auth.tenantId`; repositories always include it
in filters and never use an unscoped `findById` operation.

Responses expose only safe Client DTOs. Tenant-scoped duplicate emails become
`CLIENT_EMAIL_ALREADY_IN_USE`, missing records become `CLIENT_NOT_FOUND`, and lists use page/limit
pagination with newest-first ordering. Deletion is represented by `active`/`inactive` status updates.

## Consequences

Client creation does not create a User account. Invitations, account linking, deletion, search,
advanced filtering, projects, files, invoices, and Super Admin Client access remain deferred. The
schema/controller/service/repository boundaries remain within the modular monolith.
