# Title

Minimal Super Admin platform oversight

# Status

Accepted

# Context

The platform needs a smallest-useful oversight surface for authenticated Super Admin users without
granting them Organization Admin tenant access. The existing Organization model already defines the
`active` and `suspended` lifecycle states. Authentication uses short-lived stateless access tokens
and database-backed login and refresh checks.

# Decision

Super Admin remains a platform-level User role with no `tenantId`. Dedicated routes under
`/api/v1/super-admin` require `authenticateRequest` followed by
`requireRoles(USER_ROLE.SUPER_ADMIN)` and do not require tenant context.

The overview exposes only Organization totals by active/suspended status and tenant User totals for
Organization Admin and Client roles. Organization list and detail responses use explicit safe DTOs.
Organization user visibility is tenant-scoped, excludes Super Admin accounts, and never selects or
returns password hashes, refresh-token data, or authentication secrets. No tenant Clients, Projects,
Milestones, Files, or Invoices are queried or exposed.

Organization status control updates only `status` and supports exactly `active` and `suspended`.
Suspension retains the Organization, its users, and all tenant data. Login and refresh load current
Organization state and return HTTP 403 `ORGANIZATION_SUSPENDED` for tenant users of suspended
Organizations. Reactivation permits login and refresh again. Super Admin authentication is not
tenant-status dependent.

Access tokens are stateless and valid for 15 minutes. Suspension does not enumerate or revoke
already issued access tokens, so an existing token can remain usable until expiry. No session store,
token blacklist, or background logout process is introduced.

There is no Organization or user creation/deletion, impersonation, subscription, billing, or
tenant-business-data behavior in this module. No new dependencies are introduced.

# Alternatives considered

Reusing Organization Admin routes was rejected because it would assign or imply tenant authority for
a platform role. Immediate access-token revocation was rejected because it requires a session or
revocation store beyond this minimal scope. A larger lifecycle, billing, audit, and support console
was rejected as out of scope.

# Consequences

Super Admin gains minimal, safe platform oversight through an explicit authorization boundary.
Suspension reliably blocks new login and refresh activity, while already issued stateless access
tokens retain their documented short validity window. Future platform capabilities require separate
approval and must not inherit tenant access implicitly.
