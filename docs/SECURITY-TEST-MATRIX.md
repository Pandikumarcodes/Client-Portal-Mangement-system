# Security test matrix

All automated tests are offline. “Manual” means a browser/API check against a disposable local
environment with synthetic data, never real credentials.

| Security area | Expected invariant | Backend test file | Frontend test file | Manual | Residual limitation |
| --- | --- | --- | --- | --- | --- |
| Login | Generic invalid credentials; safe DTO; no refresh token JSON | auth service/routes tests | login page test | Active/invalid/suspended login | No MFA or lockout |
| Refresh rotation | New tokens; current User/Organization checked | auth service/routes tests | `src/App.test.jsx` | Refresh and old-token replay | Old copied token is not invalidated |
| Logout | Cookie cleared with matching scope | auth cookie/routes tests | `src/App.test.jsx` | Logout then restore | Copied token remains valid |
| Organization suspension | Login, refresh, and tenant requests rejected; Super Admin unaffected | auth tests; `authorization-matrix.integration.test.js` | `src/App.test.jsx` | Suspend/reactivate tenant roles | Access JWT itself is not revoked |
| Client isolation | All queries tenant-scoped; cross-tenant appears missing | `tenant-isolation.integration.test.js`; Client tests | Client API/page tests | Tenant A read/update/list | Future queries must preserve policy |
| Project isolation | Tenant-scoped CRUD and Client ownership checks | tenant-isolation; Project tests | Project API/page tests | Tenant A read/update/list | No Client-user access |
| Child isolation | Parent first; child filter includes tenant/project/ID | tenant-isolation; File/Invoice tests | nested page/API tests | Wrong parent/tenant | No backend Milestone module |
| File upload | One field, 10 MiB, allowlist, random contained storage, rollback | Project File upload/service/storage tests | upload form/API tests | Approved/rejected formats | No content or malware scanning |
| File download | Authenticated scoped stream, attachment, no-store, no paths | Project File route/service/storage tests | Project File API/page tests | Cross-tenant/archive download | Local storage limits |
| Invoice isolation | Parent first and scoped child filters | tenant-isolation; Invoice tests | Invoice API/page tests | Cross-tenant update | Manual status is not payment proof |
| Dashboard isolation | Every count contains tenantId; DTO omits it | Dashboard tests; tenant-isolation | Dashboard API/page tests | Compare tenants | Milestones are zero |
| Super Admin separation | Platform routes only; no tenant business data | authorization matrix; Super Admin tests | `src/App.test.jsx`; Super Admin tests | Cross-role routes | No impersonation |
| Mass assignment | Strict schemas and allow-listed updates | `mass-assignment.integration.test.js`; repository tests | domain API tests | Submit protected fields | Maintain for future fields |
| DTO safety | Explicit mapping; no tenant/storage/hash internals | module service/controller tests | normalizer/API tests | Inspect responses | Platform DTOs expose Organization IDs |
| Error safety | Generic unknown errors; request ID; no X-Powered-By | app/middleware/validation/File tests | safe error/rendering tests | Trigger 400/404/500 | Logs need access control |
| Browser storage | Tokens and records stay in memory | Not applicable | auth/domain/Dashboard tests | Inspect browser storage | Reload uses refresh cookie |
| Frontend routing | Direct navigation denied by role | backend authorization matrix | `src/App.test.jsx` | Cross-role routes | Frontend is defense in depth |
| Secret handling | Local env/runtime ignored; tracked matches are placeholders/fixtures | repository commands | repository commands | Review Git status | Heuristic, not history scanning |
