# Title

Minimal Super Admin frontend

# Status

Accepted

# Context

Super Admin needs a small platform oversight interface that remains separate from Organization
Admin tenant workflows and uses the existing in-memory authentication and application shell.

# Decision

Dedicated role-guarded routes are provided at `/super-admin`,
`/super-admin/organizations`, and `/super-admin/organizations/:organizationId`. Super Admin
navigation contains only Platform Overview, Organizations, and Logout. Tenant Dashboard, Clients,
Projects, Milestones, Files, and Invoices navigation is hidden.

The overview contains only Organization and tenant-user counts. The Organization list supports
active/suspended filtering and 20-item pagination. Organization detail displays safe basic metadata,
tenant-user counts, a read-only paginated user list with supported role/status filters, and explicit
Activate/Suspend controls.

Suspension is a status change, not deletion. The interface states that tenant data is retained and
does not claim immediate revocation of stateless access tokens. It exposes no tenant business
records and provides no Organization creation/deletion, user mutation, password reset, or
impersonation.

Platform responses remain in local component state, use request cancellation and stale-response
protection where pagination or filtering can race, and are not persisted in browser storage. No new
dependencies are introduced.

# Alternatives considered

Adding platform items to tenant navigation was rejected because the roles have different authority.
A global Super Admin context was rejected because page-local state is sufficient. Charts, search,
bulk actions, billing, analytics, and tenant drill-downs were rejected as outside the minimal scope.

# Consequences

Super Admin has a focused platform experience while tenant navigation and route protection remain
unchanged. Reloading a page refetches current platform data. Existing access tokens may remain valid
until their short backend expiry after suspension, matching the backend contract.
