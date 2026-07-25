# Title

Basic tenant-scoped Project Invoice API

# Status

Accepted

# Context

Organization Admins need a small way to record Invoice information for existing Projects. The
capability must preserve tenant isolation and Project ownership without becoming an accounting
system, payment system, tax engine, document-delivery system, or recurring-billing product.

# Decision

Invoices are tenant-owned and Project-scoped. Before every Invoice create, list, read, or update,
the service verifies Project ownership through the existing `findProjectById` repository operation
using both `tenantId` and `projectId`. Only authenticated Organization Admins are supported.
Client users and Super Admins have no Invoice access.

The Invoice record is intentionally minimal: Project, manually entered Invoice number, integer
`amountCents`, currency, required issue and due dates, status, optional notes, and timestamps.
Amounts are persisted as integer cents, never floating-point dollars. USD is the only MVP currency.
Invoice-number uniqueness is not enforced in this MVP, so different or identical tenants may reuse
numbers; any future uniqueness policy is deferred.

Both `issueDate` and `dueDate` are required, and the due date must be on or after the issue date.
The final date relationship is checked at the service boundary, including partial updates that
combine incoming and stored values. Past dates are allowed. Overdue status is neither calculated
nor stored.

Supported statuses are `draft`, `sent`, `paid`, and `void`. New records default to `draft`.
Status is changed manually through the normal PATCH endpoint. Selecting `paid` does not process a
payment, and status changes do not create fields such as `paidAt`, `sentAt`, or `voidedAt`. Void
retains the record and is not deletion. Invoice deletion is unsupported.

Listing is newest first and supports page/limit pagination plus an optional status filter. Routes
follow the existing validation, controller, service, and repository boundaries. Responses use an
explicit safe DTO that excludes `tenantId`. No new dependency is introduced.

Line items, products, services, subtotals, taxes, discounts, balances, accounting calculations,
payments and payment providers, PDFs, email delivery, recurring billing, reminders, automatic
overdue behavior, Client-user access, and Super Admin management are deferred.

# Alternatives considered

- Floating-point major currency units were rejected because binary floating-point persistence is
  unsuitable for an exact minimal money record.
- Automatic Invoice numbering and uniqueness enforcement were rejected because numbering policies
  are tenant-specific and are not required for this MVP.
- Dedicated mark-paid, send, payment, PDF, and email endpoints were rejected because status is a
  manual record field and those workflows are outside the approved capability.
- Automatic overdue status was rejected because it requires time-based business automation that is
  intentionally absent.

# Consequences

Every Invoice repository operation must remain scoped by both tenant and Project, and every service
operation performs a tenant-scoped Project check first. This creates an additional Project lookup
but makes missing and cross-tenant resources indistinguishable. Consumers must send integer cents
and format USD values themselves. Invoice numbers may be duplicated. Status values describe only
the manually maintained record; they do not prove delivery or payment. Any later accounting,
payment, document, access, or numbering capability requires a separate approved decision.
