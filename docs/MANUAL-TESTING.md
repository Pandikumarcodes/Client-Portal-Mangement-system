# Manual end-to-end testing

Use only fictional data in a local or dedicated non-production environment. Replace placeholders
such as `<TOKEN>`, `<PROJECT_ID>`, and `<FILE_ID>`; do not save real tokens in source files or shell
history. Backend API base: `http://localhost:5000/api/v1`.

## 1. Environment preparation

- [ ] `backend/.env` and `frontend/.env` exist and contain no shared/production credentials.
- [ ] Atlas URI points to the intended test database and connectivity passes `npm.cmd run db:check`.
- [ ] `PROJECT_FILE_STORAGE_ROOT` is private, writable, and outside frontend output.
- [ ] `VITE_API_BASE_URL` ends in `/api/v1`.
- [ ] `git status --ignored` shows `.env`, `node_modules`, `dist`, and runtime File content ignored.
- [ ] Tracked-file secret scan is clean.
- [ ] Git status is clean before recording test evidence (or all expected documentation changes are
  understood).

## 2. Startup and health

- [ ] From `backend`, run `npm.cmd run dev`; confirm database connects before the listener starts.
- [ ] From `frontend`, run `npm.cmd run dev`; open the printed origin.
- [ ] `Invoke-RestMethod http://localhost:5000/api/v1/health` returns 200/healthy/connected.
- [ ] Health exposes no URI, credentials, tokens, host internals, or stack.
- [ ] Stop backend with `Ctrl+C`; confirm safe shutdown logs and database disconnect.
- [ ] Restart backend and confirm health recovers.

## 3. Organization registration and authentication

```powershell
$api = "http://localhost:5000/api/v1"
$registration = @{
  organizationName = "Northstar Studio"
  organizationSlug = "northstar-studio-test"
  firstName = "Avery"
  lastName = "Morgan"
  email = "avery.admin@example.test"
  password = "TestOnly9Password"
} | ConvertTo-Json
$registered = Invoke-RestMethod -Method Post -Uri "$api/auth/register" `
  -ContentType "application/json" -SessionVariable webSession -Body $registration
$accessToken = $registered.data.accessToken
$headers = @{ Authorization = "Bearer $accessToken" }
```

- [ ] Registration returns 201, safe Organization/user fields, and an access token.
- [ ] Response JSON does not contain a refresh token, password, hash, or tenant ID.
- [ ] Duplicate email and slug return safe conflicts.
- [ ] Login succeeds with correct credentials and fails generically with an invalid password.
- [ ] Password whitespace behavior matches the entered value (passwords are not trimmed).
- [ ] A protected route works with the bearer token and returns 401 without it.
- [ ] `POST /auth/refresh` with `-WebSession $webSession` returns a new access token.
- [ ] Where manually practical, try an older rotated refresh value and record that replay is not
  prevented; do not present rotation as server-side revocation.
- [ ] `POST /auth/logout` clears the cookie and returns 204.
- [ ] Browser refresh restores a valid session through the HTTP-only cookie.
- [ ] Access token is absent from localStorage, sessionStorage, IndexedDB, cookies, URL, and logs.

## 4. Client Management

```powershell
$clientBody = @{
  firstName = "Jordan"; lastName = "Lee"
  email = "jordan.lee@example.test"; companyName = "Bluebird Labs"
} | ConvertTo-Json
$createdClient = Invoke-RestMethod -Method Post -Uri "$api/clients" `
  -Headers $headers -ContentType "application/json" -Body $clientBody
$clientId = $createdClient.data.client.id
```

- [ ] Create a Client and confirm status defaults to `active`.
- [ ] List Clients; verify default and explicit pagination metadata.
- [ ] Filter `status=active` and `inactive`; verify empty filtered state.
- [ ] Open details, edit each allowed field, deactivate, and reactivate.
- [ ] Clear optional company name using `null`.
- [ ] Submit invalid email, overlong data, an empty patch, and unknown query.
- [ ] Submit forbidden `tenantId`, `userId`, or unknown body field; expect validation failure.
- [ ] Duplicate email is rejected within one tenant.
- [ ] There is no delete or invitation action.

## 5. Project Management

```powershell
$projectBody = @{
  clientId = $clientId
  name = "Website Refresh"
  description = "Fictional portfolio demonstration."
} | ConvertTo-Json
$createdProject = Invoke-RestMethod -Method Post -Uri "$api/projects" `
  -Headers $headers -ContentType "application/json" -Body $projectBody
$projectId = $createdProject.data.project.id
```

- [ ] Create a Project for a Client in the same tenant.
- [ ] A missing/other-tenant Client ID appears not found.
- [ ] List and paginate; filter by each status and `clientId`.
- [ ] Open details and direct browser URL; refresh the page.
- [ ] Edit name, description, Client assignment, and status.
- [ ] Clear description with `null`.
- [ ] Move through `active`, `on_hold`, `completed`, and `archived`.
- [ ] Confirm archive is reversible metadata and no delete action exists.
- [ ] Reject invalid IDs, empty patches, forbidden tenant ID, and unknown fields.

## 6. Milestones

- [ ] Record that the frontend contains Milestone pages but the backend endpoint is absent.
- [ ] Do not mark Milestone creation/list/detail/edit as passing end to end.
- [ ] Confirm the root README/demo explains this limitation and dashboard Milestone counts are zero.

## 7. Project Files

```powershell
$uploadPath = "C:\path\to\fictional-deliverable.pdf"
curl.exe -X POST "$api/projects/$projectId/files" `
  -H "Authorization: Bearer $accessToken" `
  -F "file=@$uploadPath;type=application/pdf" `
  -F "description=Fictional approved deliverable"
```

- [ ] Upload one allowlisted PDF/PNG/JPEG/TXT/CSV/DOCX/XLSX under 10 MiB.
- [ ] Confirm original name, type, size, description, and active status; confirm no stored path/name.
- [ ] Reject an unsupported MIME type with 415.
- [ ] Reject a file over 10 MiB with 413.
- [ ] Reject no file or multiple files.
- [ ] List, paginate, filter active/archived, and open details.
- [ ] Edit/clear description; archive and restore.
- [ ] Download with the authenticated UI and with a bearer request; verify bytes/name.
- [ ] Download an archived File successfully.
- [ ] Request metadata/download without auth, as Client, as Super Admin, and from another tenant.
- [ ] Try the runtime storage path as a public URL; confirm it is not served.
- [ ] Confirm responses never reveal `storedName`, `storagePath`, or tenant ID.
- [ ] Simulate an unavailable/non-writable storage root only in a disposable environment; confirm a
  safe error, not a raw filesystem path.

PowerShell binary download:

```powershell
Invoke-WebRequest -Uri "$api/projects/$projectId/files/<FILE_ID>/download" `
  -Headers $headers -OutFile ".\manual-download.tmp"
```

Delete the local manual output after inspection; do not commit it.

## 8. Invoices

```powershell
$invoiceBody = @{
  invoiceNumber = "INV-DEMO-001"
  amountCents = 125000
  issueDate = "2026-07-01"
  dueDate = "2026-07-31"
  notes = "Fictional demo invoice"
} | ConvertTo-Json
$createdInvoice = Invoke-RestMethod -Method Post `
  -Uri "$api/projects/$projectId/invoices" -Headers $headers `
  -ContentType "application/json" -Body $invoiceBody
```

- [ ] Create and confirm `125000` is displayed as USD 1,250.00.
- [ ] Reject fractional cents, zero, above maximum, or due date before issue date.
- [ ] List/paginate and filter `draft`, `sent`, `paid`, and `void`.
- [ ] Open details and direct browser route.
- [ ] Edit number, cents, dates, notes, and status.
- [ ] Clear notes with `null`.
- [ ] Set sent, paid, and void; confirm these are manual record statuses.
- [ ] Confirm no delete, payment, refund, PDF, email, tax, or overdue action.
- [ ] Confirm another tenant cannot read/update the Invoice.

## 9. Organization dashboard

- [ ] Open `/dashboard` as Organization Admin.
- [ ] Verify Client, Project, File, and Invoice totals/statuses against created records.
- [ ] Confirm Milestone values are zero and no trend/revenue claims appear.
- [ ] Verify loading, all-zero, error, retry, and navigation states.
- [ ] Confirm counts are tenant-separated and no tenant ID is shown.

## 10. Super Admin

Super Admin accounts are not created by a public API. Use an existing safely provisioned test
account; never add credentials to the repository.

- [ ] Login and open platform overview.
- [ ] List Organizations; test active/suspended filters and pagination.
- [ ] Open Organization details and safe tenant-user counts/list.
- [ ] Filter users by Organization Admin/Client and status.
- [ ] Suspend the fictional test Organization; data remains present.
- [ ] Confirm suspended Organization login and refresh return `ORGANIZATION_SUSPENDED`.
- [ ] Confirm an already-issued access token is stateless but composed tenant routes perform a live
  status check and deny it.
- [ ] Reactivate and confirm normal login/tenant access returns.
- [ ] Attempt `/clients`, `/projects`, Files, Invoices, and tenant dashboard as Super Admin; expect
  `FORBIDDEN`.
- [ ] Attempt platform routes as Organization Admin and Client; expect `FORBIDDEN`.
- [ ] Confirm no delete, user mutation, impersonation, or tenant-record controls exist.

## 11. Two-Organization tenant isolation

1. [ ] Register fictional Organization A and B with separate browser/API sessions.
2. [ ] Create a Client, Project, File, and Invoice in each.
3. [ ] With A's token, request B's IDs through list/detail/update/download paths.
4. [ ] With B's token, repeat against A.
5. [ ] Confirm approved not-found behavior rather than forbidden/existence disclosure.
6. [ ] Confirm lists/counts contain only the active tenant.
7. [ ] Confirm no DTO, validation error, UI, URL, or browser storage leaks tenant ID.

## 12. Validation and errors

- [ ] Invalid JSON returns `INVALID_JSON`.
- [ ] JSON body above 1 MiB returns `PAYLOAD_TOO_LARGE`.
- [ ] Unknown/forbidden fields return bounded `VALIDATION_ERROR` details without raw secrets.
- [ ] Invalid IDs, pagination, status, and date values return 400.
- [ ] Unknown API path/method returns safe `RESOURCE_NOT_FOUND`.
- [ ] Database/storage/internal failures return safe 5xx without stacks or infrastructure details.
- [ ] Error pages do not render raw JSON.
- [ ] Retry controls recover after transient failures.

## 13. Frontend page-state matrix

For every reachable list/detail/form/dashboard/platform page:

- [ ] Loading state is visible and understandable.
- [ ] Success state contains safe formatted data.
- [ ] Empty and filtered-empty states differ where relevant.
- [ ] Error state is human-readable and offers retry where implemented.
- [ ] Direct navigation and browser refresh work with SPA fallback/auth restoration.
- [ ] Keyboard focus is visible; controls and labels are keyboard operable.
- [ ] Mobile-width layout (about 375 px) has no critical clipping/overlap.
- [ ] No raw JSON, token, internal ID beyond record IDs, tenant ID, or storage path is shown.
- [ ] Role navigation contains no forbidden links.

## 14. Browser storage and logout

- [ ] Access token exists only in React memory.
- [ ] No tenant/platform records, File/Blob/object URLs, or form drafts appear in localStorage,
  sessionStorage, or IndexedDB.
- [ ] Refresh cookie is HTTP-only and scoped to the auth path.
- [ ] Logout clears UI state and refresh cookie; protected routes redirect.
- [ ] Back/refresh after logout does not restore authenticated content.

## 15. Production-like smoke checks

- [ ] Backend runs with `NODE_ENV=production` and `npm.cmd start`.
- [ ] Frontend `npm.cmd run build` succeeds with production-like API base.
- [ ] `npm.cmd run preview` serves the built assets for local inspection.
- [ ] Real static-host configuration falls back unknown React routes to `index.html`.
- [ ] Exact HTTPS frontend origin matches backend CORS.
- [ ] Production refresh cookie is Secure/HTTP-only/SameSite-compatible.
- [ ] Persistent storage is writable and retains a test File across a controlled redeploy/restart.
- [ ] Health, structured logs, and request IDs work.
- [ ] Logs/browser output contain no credentials.
- [ ] File download remains authenticated and private.

## 16. Final handoff verification plan

### Local

1. [ ] Complete a fresh clone.
2. [ ] Run the backend clean install.
3. [ ] Run the frontend clean install.
4. [ ] Create both environment files from examples.
5. [ ] Verify the database with the real diagnostic command.
6. [ ] Start the backend.
7. [ ] Start the frontend.
8. [ ] Verify health.
9. [ ] Register a fictional Organization.
10. [ ] Log in.
11. [ ] Complete the Organization Admin Client/Project workflow.
12. [ ] Complete the Project File upload, metadata, archive/restore, and download workflow.
13. [ ] Complete the Invoice create/edit/status/filter workflow.
14. [ ] Reconcile dashboard counts.
15. [ ] Complete the Super Admin overview/Organization/user workflow.
16. [ ] Suspend and reactivate the test Organization.
17. [ ] Log out.
18. [ ] Refresh the browser and verify auth restoration when logged in.
19. [ ] Verify role denials.
20. [ ] Verify two-Organization tenant isolation.
21. [ ] Inspect important pages at mobile width.
22. [ ] Inspect browser storage.

### Production-like

23. [ ] Run the backend production start command.
24. [ ] Create the frontend production build.
25. [ ] Inspect it with frontend preview.
26. [ ] Verify the build points to the production-like backend.
27. [ ] Verify the real host's direct-route SPA fallback.
28. [ ] Configure CORS for the exact frontend origin.
29. [ ] Verify cookie flags and site relationship are suitable for HTTPS.
30. [ ] Verify persistent storage is writable and retained.
31. [ ] Verify health responds.
32. [ ] Verify structured logs contain request IDs.
33. [ ] Verify no secrets appear in browser output or logs.
34. [ ] Verify File downloads remain authenticated.
35. [ ] Restart and confirm MongoDB data and stored Files survive on correctly mounted storage.

### Portfolio

36. [ ] Render the root README on GitHub.
37. [ ] Open every documentation link.
38. [ ] Prepare non-sensitive screenshots or a screenshot plan.
39. [ ] Confirm all demo data is fictional.
40. [ ] Rehearse the two-minute demo.
41. [ ] Rehearse the five-minute architecture explanation.
42. [ ] State known limitations honestly.
43. [ ] Record exact test counts from the final successful run.
44. [ ] Keep the live-demo fallback pack ready.
