# Frontend Agent Rules

- Keep access tokens in React memory only; never use localStorage, sessionStorage, IndexedDB, or
  application cookies for tokens.
- Never log tokens, credentials, request bodies, or cookie contents.
- Route all API calls through `src/core/api/api-client.js`.
- Send authenticated requests with the in-memory `accessToken` as a Bearer header.
- Always use `credentials: 'include'`; never attempt to read the HTTP-only refresh cookie.
- Frontend route guards do not replace backend authentication, authorization, or tenant checks.
- Keep features isolated by domain and avoid adding libraries without demonstrated need.
- Never supply tenant ID from frontend Client forms or Client API request bodies.
- Route Client operations through `src/features/clients/client-api.js`, using the in-memory access
  token for every protected request.
- Client pages must never render `tenantId` or `userId`.
- Frontend role guards improve navigation but never replace backend authorization and tenant
  enforcement.
- Client deactivation is a reversible status change, not deletion.
- Do not add Client invitation behavior without a separate approved prompt.
- Project routes are Organization Admin-only.
- Never send `tenantId` from frontend Project forms or Project API requests.
- Route Project operations through `src/features/projects/project-api.js` and the authenticated
  request utility.
- Do not store Project records or tokens in browser storage.
- Do not add Project deletion. Archive Projects through a status update.
- Milestone routes are nested under Projects and are Organization Admin-only.
- Do not add a top-level Milestones navigation item.
- Route Milestone operations through the authenticated API utility; never send `tenantId` or put
  `projectId` in a Milestone request body.
- Do not store Milestone records in browser storage.
- Milestone completion is a status update. Do not add Milestone deletion or task-management
  features without an approved prompt.
- Project File routes are nested beneath Projects and are Organization Admin-only.
- Do not add a top-level Files navigation link.
- Route Project File operations through the authenticated API utility.
- Never send `tenantId`, and never put `projectId` in Project File multipart bodies.
- Do not manually set multipart `Content-Type` for `FormData`.
- Never expose `storedName` or `storagePath`.
- Do not persist File objects, Blobs, or Project File metadata in browser storage.
- Downloads must use authenticated fetch and revoke temporary object URLs.
- Do not add public URLs, hard deletion, or file replacement.
- Project File archiving is a metadata status change.
- Do not add previews, versioning, Client access, or cloud SDKs without an approved prompt.
- Invoice routes are nested beneath Projects and are Organization Admin-only.
- Do not add a top-level Invoices navigation item.
- Route Invoice operations through the authenticated API utility.
- Never send `tenantId`, and never put `projectId` in an Invoice request body.
- Keep integer `amountCents` as the backend money representation and convert user-entered USD
  decimal strings deterministically. Do not store floating-point dollar values as API state.
- USD is the only approved MVP Invoice currency.
- Do not calculate Invoice overdue state.
- Do not store Invoice records or form drafts in browser storage.
- Paid is a manual record status, not evidence of an integrated payment. Void is a status change,
  not deletion.
- Do not add Invoice payments, line items, taxes, PDF generation, email delivery, or Client access
  without an approved prompt.
- Resolve Client labels from a shared Client collection; do not create per-Project Client requests.
- The Organization Dashboard is Organization Admin-only and must use the authenticated API utility.
- Never submit or display `tenantId` in Dashboard requests or screens.
- Dashboard counts are current-state summaries only and Dashboard data must not be stored in browser
  storage.
- Do not add Dashboard charts, trends, percentages, revenue totals, overdue counts, file-storage
  totals, polling, or caching without an approved architecture prompt.
- Milestones, Files, and Invoices remain Project-scoped; do not add top-level navigation for them.
- Do not invent a Client dashboard endpoint. A Super Admin dashboard requires a separate approved
  prompt.
