# Client Portal Frontend

This frontend uses React, Vite, React Router, native `fetch`, and React Context. Install and run
with `npm install`, `npm run dev`, `npm run build`, `npm run lint`, or `npm test`.

Set `VITE_API_BASE_URL` in `.env` (the example points to `http://localhost:5000/api/v1`). No secrets
belong in frontend environment variables. The API client always sends `credentials: 'include'` so
the HTTP-only refresh cookie participates in authentication.

`AuthProvider` bootstraps with `POST /auth/refresh`, keeps the access token in memory only, and
exposes the current user, organization, and role-aware route state. Protected routes use the
`Authorization: Bearer <access-token>` contract. Browser JavaScript never reads the refresh cookie.

Login and registration are intentional placeholder pages until Prompt 18. The current role homes,
route guards, refresh bootstrap, and logout shell do not implement client, project, dashboard, or
Super Admin management features.
