# ADR-019: Minimal Tenant-Owned Client Profile

## Status

Accepted

## Context

An Organization Admin needs a business-customer profile that can exist before the customer receives
portal access. This profile is distinct from the User authentication identity and must remain small
while preserving tenant isolation.

## Decision

Create a `Client` model owned by exactly one Organization through required `tenantId`. It stores only
first name, last name, email, optional company name, status, and optional `userId` for a future linked
User account. Client email uniqueness is scoped by `{ tenantId, email }`, so the same email may exist
in different Organizations. A tenant listing index and sparse unique linked-user index support the
initial persistence needs.

The model uses strict persistence invariants, timestamps, no version key, and no hooks, methods,
population, authentication, or workflows. Future services must obtain tenant scope from
`request.auth.tenantId`, never from request input.

## Alternatives considered

Embedding portal credentials in Client was rejected because Client and User authentication identities
have different lifecycles. Global email uniqueness was rejected because client identity is tenant
scoped. Adding ownership, invitation, project, invoice, or contact-detail fields was deferred to keep
the MVP model minimal.

## Consequences

An Organization can manage a client profile without creating a User account. Future account linking,
invitations, Client CRUD, projects, and invoices can build on the model without changing tenant
ownership semantics. Those workflows and APIs remain deferred.
