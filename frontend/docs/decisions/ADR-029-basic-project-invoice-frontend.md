# Title

Basic Project Invoice frontend

# Status

Accepted

# Context

Organization Admins need a minimal record-management interface for Invoices belonging to existing
Projects. The backend exposes nested create, list, detail, and update endpoints. The frontend must
preserve the authenticated tenant boundary while avoiding payment processing, accounting,
document-delivery, and Client-portal concerns.

# Decision

Invoices are presented inside the parent Project experience. The Project detail page contains the
Invoice list, a single status filter, backend pagination, loading and empty states, and a Create
Invoice action. There is no top-level Invoice navigation item. Create, detail, and edit screens use
routes nested beneath `/projects/:projectId`, and all remain inside the authenticated Organization
Admin role boundary. Client and Super Admin users are not supported.

All Invoice requests reuse the existing authenticated API utility, configured
`VITE_API_BASE_URL`, in-memory access token, refresh behavior, and safe API error normalization.
The frontend never sends `tenantId`, and `projectId` is used only in nested URLs rather than
Invoice request bodies. Invoice records and form drafts are not stored in browser storage.

One reusable form supports creation and editing. Creation hides status so the backend applies
`draft`. Editing permits `draft`, `sent`, `paid`, and `void`. Status is manually managed: `paid`
does not represent an integrated payment transaction, and `void` retains the Invoice rather than
deleting it. Blank create notes are omitted; blank edited notes are sent as `null` to clear them.

`amountCents` remains the API money representation. The user-facing Amount (USD) field is retained
as a controlled decimal string and converted deterministically with string parsing into integer
cents. It accepts no currency symbols, separators, scientific notation, negatives, zero, or more
than two fractional digits. USD is the only supported currency. Display uses `en-US` USD currency
formatting, with no conversion or abbreviated values.

Issue and due dates use native HTML date inputs. Existing date-only validation and UTC-midnight
conversion are reused so `YYYY-MM-DD` values round trip without a visible timezone shift. Both
dates are required, past dates are allowed, equality is allowed, and due date must be on or after
issue date. No overdue status or presentation is calculated.

The list uses backend pagination at 20 records per page and one optional status filter. Changing
the filter resets pagination to page one. Abortable effects prevent stale Project, filter, or page
responses from becoming current. There is no DELETE behavior.

# Alternatives considered

A top-level Invoice area, global Invoice state, browser-storage caching, floating-point dollar API
state, currency and date libraries, custom date or money controls, client-side pagination,
optimistic updates, special send/pay/void endpoints, payment providers, and a separate create/edit
form were rejected because they exceed this minimal record-management contract.

# Consequences

Organization Admins can list, filter, create, view, edit, clear notes, and manually change Invoice
status within Project context. No new frontend dependency was installed. Line items, products,
services, taxes, discounts, totals, payments and payment providers, refunds, PDFs, email delivery,
recurring billing, automatic overdue state, deletion, Client-user access, and Super Admin Invoice
management remain deferred.
