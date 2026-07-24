# ADR-011: Add User Identity and Tenant Membership Persistence

## Status

Accepted

## Context

The backend now has an Organization tenant root but needs a persistence shape for platform and
tenant identities. The first version must distinguish platform Super Admins from Organization Admins
and Clients without introducing authentication workflows, ownership relationships, or a
multi-organization membership subsystem.

Password security and authorization require dedicated components. The persistence model should
therefore store only a password hash and encode membership invariants without querying the
Organization collection.

## Decision

Represent platform and tenant identities with one User model in the shared `users` collection.
Super Admin users have role `super_admin` and must not contain `tenantId`. Organization Admin and
Client users have roles `organization_admin` and `client` and require one `tenantId` referencing
Organization. A User belongs to at most one Organization initially; multi-organization membership
and a separate OrganizationMembership collection are deferred.

User statuses are `active`, `invited`, and `suspended`, defaulting to `active`. Email is trimmed,
lowercased, and globally unique through `uniq_users_email`. Global uniqueness keeps initial
email-and-password login unambiguous without requiring a tenant slug. The tenant lookup index
`idx_users_tenant_id` supports future scoped access. Both are database constraints, and future
services must translate duplicate-key errors into safe ApiError responses.

Only `passwordHash` is persisted, with `select: false` as a query-safety default. Password hashing,
verification, registration, login, JWTs, invitation processing, and authorization belong to a later
authentication-security component and are not implemented through Mongoose hooks.

The model validates the shape and conditional tenant membership only. It does not query Organization
to verify referential existence. Organization ownership is deferred to the next prompt after both
models exist. User routes, controllers, services, repositories, request schemas, response DTOs, and
authentication workflows are not implemented. The design remains inside the modular monolith.

## Alternatives considered

Allowing Super Admins to carry `tenantId` was rejected because they are platform-level identities.
Requiring every User to have `tenantId` was rejected because it would incorrectly tenant-scope Super
Admins. A membership collection was rejected because one-Organization membership is sufficient for
the first version.

Tenant-scoped email uniqueness was rejected initially because global email identity simplifies
email-and-password login. Querying Organization during validation was rejected because referential
existence belongs to services and repositories, not document validation.

Storing raw passwords, hashing in model hooks, or adding token fields was rejected because password
security and authentication lifecycle require a dedicated component. Adding owner relationships
was rejected until the User and Organization ownership design is explicitly decided.

## Consequences

The persistence model clearly separates platform identity from tenant membership while keeping one
User per email in the first version. Tenant-owned users can be scoped through `tenantId`, and
password hashes receive a default query exclusion.

Future authentication code must hash and verify credentials outside the model and must keep
`passwordHash` out of responses and logs. Future services must verify Organization references,
translate duplicate-key failures safely, and enforce authorization. Registration, login, ownership,
multi-organization membership, and all User-facing HTTP behavior remain future work.
