# Demo readiness guide

## 1. Purpose

Demonstrate a credible multi-tenant full-stack MVP: an Organization Admin manages core client work,
while a separated Super Admin oversees Organization status without accessing tenant records.

## 2. Prerequisites

- [ ] Backend/frontend validation commands pass and results are recorded accurately.
- [ ] MongoDB, backend health, frontend API URL, CORS, cookies, and file volume are verified.
- [ ] Organization Admin and safely provisioned Super Admin test accounts are available outside
  source control.
- [ ] Fictional data is loaded and no real customer/person/credential appears.
- [ ] Direct SPA routes and authenticated downloads work.
- [ ] Browser storage and logs have been inspected for secrets.

## 3. Safe fictional data

| Type | Example |
| --- | --- |
| Organization | Northstar Studio |
| Admin | Avery Morgan, `avery.admin@example.test` |
| Client | Jordan Lee, Bluebird Labs |
| Project | Website Refresh |
| File | `homepage-wireframe.pdf` containing non-sensitive sample content |
| Invoice | `INV-DEMO-001`, USD 1,250.00, draft |
| Second tenant | Cedar & Finch Co. |

Choose a unique Organization slug per environment. Keep passwords in a private demo credential
manager, not code, docs, shell scripts, screenshots, or commits.

## 4. Two-minute demo

1. Log in as Organization Admin and show the current-state dashboard.
2. Open a Client and its Project.
3. Show safe File metadata, then download through the authenticated UI.
4. Show an Invoice with exact USD/cents handling.
5. Switch to Super Admin: show Organizations and explain that tenant records are unavailable.
6. State the central design: trusted token tenant context plus tenant-scoped repository queries.

Do not open Milestone pages as a working workflow; no backend Milestone API exists.

## 5. Five-minute demo

1. Register or log in as the fictional Organization Admin.
2. Create a Client, filter the list, and show pagination controls.
3. Create a Project and explain same-tenant Client ownership validation.
4. Upload an allowlisted File; show that storage names/paths are absent; download it.
5. Create an Invoice, show integer cents and manual statuses.
6. Return to dashboard and reconcile counts.
7. Log in as Super Admin, inspect an Organization, suspend and reactivate it.
8. Show a denied tenant route for Super Admin and explain platform/tenant separation.

## 6. Ten-minute technical walkthrough

1. Start at the root architecture diagram.
2. Trace one request through route, auth, role, live tenant status, Zod, controller, service,
   repository, and model.
3. Show strict schemas/DTOs and a tenant-scoped query.
4. Trace access/refresh authentication and browser restoration.
5. Explain File metadata versus protected persistent bytes and rollback behavior.
6. Explain integer `amountCents` and fixed USD.
7. Show authorization, mass-assignment, and tenant-isolation integration tests.
8. Explain Super Admin's limited DTOs and dedicated routes.
9. Show production build, health, structured request-ID logs, and deployment requirements.
10. Close with honest trade-offs and deferred work.

## 7. Architecture talking points

- A modular monolith fits one team/MVP while preserving domain boundaries.
- Controllers translate HTTP; services own business rules; repositories own persistence.
- Tenant IDs are never accepted from browser input.
- Project child resources require both tenant and parent Project scope.
- Platform routes deliberately do not inherit tenant access.
- React pages call domain APIs through one relative-path Fetch utility.

## 8. Security talking points

- Access tokens stay in memory; refresh token is HTTP-only and rotates.
- Exact-origin CORS and credentialed requests replace wildcard access.
- Strict validation and update allowlists resist mass assignment.
- Cross-tenant records appear missing.
- Generated filenames and authenticated streams keep storage private.
- Suspension is checked at login, refresh, and current composed tenant routes.
- Limits are explicit: no malware scanning, MFA, refresh replay detection, or general token
  revocation.

## 9. Trade-offs

- Filesystem storage is simple but requires a persistent/shared volume.
- Stateless access tokens scale simply but cannot be immediately revoked cryptographically.
- Live Organization checks strengthen suspension at a database-read cost.
- Current count queries are fresh but uncached.
- Declared MIME allowlisting does not validate file signatures/content.
- Frontend Milestone work is incomplete without the backend.

## 10. Known limitations to state

No payments, recurring billing, PDFs, notifications, advanced analytics, reports, exports, password
reset, MFA, antivirus, Client business portal, deletion, impersonation, or end-to-end Milestones.
There is no production scale claim or compliance certification.

## 11. Failure recovery

| Failure | Response |
| --- | --- |
| Backend down | Show health failure, restart locally, use recorded API/test evidence |
| Frontend cannot reach API | Verify build-time base, API health, exact CORS origin, then use API output |
| MongoDB unavailable | Do not retry destructively; show offline tests and explain readiness 503 |
| File storage unavailable | Do not change to public/temp storage; show metadata/design and recorded download |
| Stale login cookie | Logout/clear site data for the demo origin, then log in again |
| Build fails | Preserve output, check Node/npm, env, clean install, lint/tests; use last verified recording |
| Live deployment unavailable | Run local validated build or switch to offline evidence |

Offline backup pack:

- Current screenshots without credentials
- Short local screen recording
- Architecture diagram from [Architecture](ARCHITECTURE.md)
- Sanitized API response samples
- Exact test-suite/build result text
- A fictional sample File

## 12. Final demo checklist

- [ ] Rehearse two- and five-minute paths with a timer.
- [ ] Pre-open tabs; close personal tabs and notifications.
- [ ] Clear unrelated browser console/network history.
- [ ] Verify health, database, storage write/download, CORS, and SPA fallback.
- [ ] Confirm demo credentials are not visible.
- [ ] Confirm fictional data and predictable list order.
- [ ] Verify Super Admin suspension/reactivation and denial.
- [ ] Keep the offline backup pack accessible.
- [ ] State limitations before questions.
- [ ] Never claim Milestones, scale, security certification, or measured performance.

