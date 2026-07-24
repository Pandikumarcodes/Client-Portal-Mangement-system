# ADR-010: Make Organization the Tenant Root

## Status

Accepted

## Context

The modular monolith needs its first persistence model and a clear root for tenant ownership.
Placing `tenantId` on every document without defining the root would make ownership ambiguous, while
separate databases per tenant would add operational complexity before scale or isolation
requirements justify it.

The initial Organization structure must establish durable persistence invariants without coupling
the model to HTTP handling, onboarding workflows, authentication, billing, or an incomplete User
owner relationship.

## Decision

Organization is the tenant root. The Organization document therefore does not contain `tenantId`.
Future tenant-owned documents—including users, clients, projects, milestones, invoices, files,
meetings, and notifications—will require `tenantId` referencing Organization. The initial
architecture continues to use shared collections with tenant-scoped queries rather than a database
or collection per tenant.

The initial Organization business fields are `name`, `slug`, `status`, and `plan`. Organizations
start with active or suspended lifecycle states and free or pro plans. Deletion, archival, trial,
enterprise, and other lifecycle or billing states are deferred.

Slugs use lowercase alphanumeric segments separated by single hyphens and are globally unique for
the first version. A named `uniq_organizations_slug` index enforces the database constraint. A
unique index is not complete application validation: future duplicate-key failures must be
translated into safe application errors.

Slug generation and conflict resolution belong to a future onboarding service, not the model.
Owner relationships are deferred until the User identity model is designed. Model hooks, domain
methods, tenant-access behavior, serializers, and DTOs are also deferred.

The model uses the default Mongoose connection and performs no connection operation during import.
No repository, service, controller, route, request schema, onboarding flow, or authentication
behavior is introduced. The design remains inside the modular monolith.

## Alternatives considered

Adding `tenantId` to Organization was rejected because a tenant root cannot reference itself for
ownership. A database or collection per tenant was rejected because shared collections with
required tenant scope provide a simpler initial operational model.

Adding owner fields before the User model was rejected because it would create an incomplete
circular relationship. Automatic slug generation in a model hook was rejected because generation
and conflict resolution are application workflows. Soft deletion, archival, subscription fields,
hooks, methods, and speculative indexes were rejected until concrete requirements exist.

Relying on `unique: true` only in the slug field declaration was rejected in favor of one explicit,
named schema index whose database purpose is clear.

## Consequences

The system has one explicit root for future tenant ownership. Organization documents remain small
and contain only persistence invariants, while future tenant-owned collections have a clear
`tenantId` reference and query-scoping requirement.

Organization slugs are globally reserved and duplicate creation attempts will eventually require
safe conflict handling above the model. Owner assignment, onboarding, deletion, archival, tenant
middleware, repositories, services, controllers, routes, and authentication remain future work.
