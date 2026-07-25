# ADR-030A: Basic Tenant-Scoped Dashboard Backend

## Status

Accepted

## Context

The MVP needs a current-state operational summary for Organization Admins. Existing tenant-owned
Client, Project, Project File, and Invoice models provide countable records. There is no Milestone
module in the repository, so the required Milestones response section cannot query persisted
Milestone records and remains zero until that separately approved feature exists.

## Decision

Expose a read-only `GET /api/v1/dashboard/organization` endpoint protected by authentication,
Organization Admin role authorization, and tenant context. Every count query includes the trusted
`request.auth.tenantId`; request body, query, route parameters, headers, and frontend state cannot
select a tenant. Counts use `countDocuments` with one explicit total and explicit approved status
filters. Independent bounded counts run concurrently, full records are not loaded, no references are
populated, and no Dashboard model or collection is created.

The response contains current totals and approved status counts for Clients, Projects, Milestones,
Files, and Invoices. Stored `on_hold` and `in_progress` values map to `onHold` and `inProgress`; raw or
unexpected status strings are not exposed. Missing status groups normalize to zero. Milestone
statuses are not used to calculate completion percentages. Invoice statuses are counted without
summing Invoice amounts, and Project File records are counted without summing file sizes. These are
current-state counts only: no history, date ranges, percentages, trends, overdue state, caching, or
background aggregation is calculated.

Client dashboard support is deferred because the existing Client model has an optional `userId`, but
ADR-019 reserves it for a future linked User account and the current authentication and Client CRUD
flows do not establish that relationship. Therefore the application cannot yet securely resolve the
authenticated Client user to exactly one tenant-owned Client profile and scope every query by both
`tenantId` and Client profile ID. Super Admin dashboard support is deferred to Prompt 30C.

## Alternatives considered

Loading records and filtering in application memory was rejected in favor of tenant-scoped count
queries. A Dashboard collection, cache, scheduled aggregation, and analytics module were rejected as
unnecessary for current-state MVP summaries. Email matching was rejected as a Client ownership
relationship because it is not an explicit durable rule. Creating a Milestone model solely for the
dashboard was rejected because Milestone persistence is outside this prompt.

## Consequences

Dashboard counts are inexpensive, tenant-scoped, and easy to test offline through repository
dependency injection. Missing approved status groups return zero, while repository failures fail the
whole request through centralized error handling. Dashboard routes are read-only. No new dependency,
cache, job, historical store, or aggregation collection is introduced. The endpoint remains
intentionally limited and will need new approved design work for trends, reporting, Client
dashboards, Milestone persistence, or Super Admin oversight.
