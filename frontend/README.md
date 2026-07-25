# Client Portal Frontend

This frontend uses React, Vite, React Router, native `fetch`, and React Context. Install and run
with `npm install`, `npm run dev`, `npm run build`, `npm run lint`, or `npm test`.

Set `VITE_API_BASE_URL` in `.env` (the example points to `http://localhost:5000/api/v1`). No secrets
belong in frontend environment variables. The API client always sends `credentials: 'include'` so
the HTTP-only refresh cookie participates in authentication.

`AuthProvider` bootstraps with `POST /auth/refresh`, keeps the access token in memory only, and
exposes the current user, organization, and role-aware route state. Protected routes use the
`Authorization: Bearer <access-token>` contract. Browser JavaScript never reads the refresh cookie.

Organization Admin Client Management is available at `/admin/clients`, with creation at
`/admin/clients/new` and view/edit at `/admin/clients/:clientId`. These routes are protected for
Organization Admin users only. The interface supports listing and paginating profiles, filtering by
active or inactive status, creating profiles, viewing details, editing details, and activating or
deactivating a profile.

Deactivation is not deletion: inactive Client profiles remain stored and can be reactivated. The
backend enforces tenant ownership from the authenticated session, and the frontend never sends
`tenantId`. Creating a Client profile does not create a portal User account. Client invitations,
account linking, projects, files, invoices, and other business modules are deferred.
