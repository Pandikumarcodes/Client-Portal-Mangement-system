# Deployment guide

This guide is provider-neutral. No provider, container, process manager, or live cloud deployment is
required by the repository.

## 1. Production architecture

```text
Browser
 -> HTTPS static frontend host (Vite dist + SPA fallback)
 -> HTTPS Node backend
      |-> MongoDB Atlas (TLS/SRV)
      `-> private writable persistent Project File volume
```

## 2. Backend requirements

- Node.js/npm compatible with the lockfile. No `engines` range is declared; final validation used
  Node.js 24.18.0.
- Outbound access to the Atlas SRV endpoints.
- Environment variables from the table below.
- Writable, private, persistent storage at `PROJECT_FILE_STORAGE_ROOT`.
- A service that forwards `SIGTERM` and collects stdout/stderr.

Install and validate:

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run validate
```

Start:

```powershell
$env:NODE_ENV = "production"
npm.cmd start
```

`src/index.js` is the actual entry point. It connects MongoDB before listening. Startup failure sets
a failing process exit code and attempts cleanup. `SIGINT`/`SIGTERM` stop accepting new connections
through `server.close()` and disconnect Mongoose. There is no forced shutdown deadline; configure a
reasonable platform termination grace period and monitor long-lived connections.

The app does not configure Express `trust proxy`. Current authentication does not use request IP or
Express secure-cookie auto-detection: the cookie `Secure` flag is driven by `NODE_ENV`. Preserve
`Host`, forwarded scheme, request IDs, and HTTPS at a reverse proxy, but do not claim proxy-derived
client IP semantics without a future reviewed change.

## 3. Frontend requirements

`VITE_API_BASE_URL` is public build-time configuration and must be set before the build. It must be
an absolute HTTP(S) URL ending in `/api/v1`.

```powershell
Set-Location frontend
npm.cmd ci
$env:VITE_API_BASE_URL = "https://api.example.com/api/v1"
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Deploy `frontend/dist`. The static host must:

- serve all assets over HTTPS;
- return `index.html` for unknown application routes such as `/projects/<id>`;
- preserve real asset 404s where its SPA configuration allows;
- avoid injecting secrets into `VITE_*` variables;
- permit the frontend to call the API origin.

`npm.cmd run preview` is a local build inspection tool, not a production server.

## 4. MongoDB

- Use a dedicated production database user with least privilege.
- Restrict Atlas Network Access to backend egress ranges where the platform supports stable ranges.
- Keep the SRV connection string secret; the current validator requires `mongodb+srv://`.
- Specify the intended database name in the URI.
- Atlas SRV/TLS handles transport configuration; do not disable TLS.
- Configure database backups and test restore procedures.
- Keep production, staging, and sample databases clearly separated.

## 5. Persistent Project File storage

This requirement is critical:

1. An ephemeral application filesystem is unsuitable for durable Project Files.
2. The current adapter needs a writable persistent volume mounted at
   `PROJECT_FILE_STORAGE_ROOT`.
3. That mount must survive process restarts, releases, and redeployments.
4. The path must remain private and must not be mounted as public static content or placed under
   `frontend/dist`.
5. Backups/restores must include MongoDB metadata and matching file binaries as a coordinated set.
6. One local per-instance directory does not support horizontal scaling. Multiple backend instances
   require shared storage with safe filesystem semantics or a future object-storage adapter.
7. Monitor capacity, permissions, backup age, and restore integrity.
8. Object-storage migration is deferred; no cloud SDK is present.

Metadata status changes do not remove stored bytes. A missing binary produces a safe 404 while a
malformed private path produces a safe storage error.

## 6. Environment variables

| Name | Component | Required | Purpose | Production guidance |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Backend | Optional/defaulted | Environment behavior | Set `production` for secure cookies and info logging |
| `PORT` | Backend | Optional/defaulted | Listener port | Use the service-provided value when applicable |
| `MONGO_URI` | Backend | Yes | MongoDB SRV connection | Secret; dedicated DB/user; never log |
| `DNS_SERVERS` | Backend | Optional | Node-only DNS resolver override | Leave empty unless diagnostics prove it is needed |
| `CLIENT_URL` | Backend | Yes | Sole allowed browser origin | Exact HTTPS origin, no wildcard/path/trailing slash required |
| `LOG_LEVEL` | Backend | Optional | Pino threshold | `info` is the production default |
| `JWT_ACCESS_SECRET` | Backend | Yes | Access-token signing | Unique high-entropy 32+ characters; secret manager |
| `JWT_REFRESH_SECRET` | Backend | Yes | Refresh-token signing | Different high-entropy secret; secret manager |
| `PROJECT_FILE_STORAGE_ROOT` | Backend | Optional/defaulted | Private file volume path | Explicit mounted persistent path recommended |
| `VITE_API_BASE_URL` | Frontend | Yes | Browser API base | Public HTTPS URL at build time; no secrets |

The example files include every variable expected by validation. Backend defaults do not make
`MONGO_URI`, `CLIENT_URL`, or the JWT secrets optional.

## 7. Build and start commands

| Component | Install | Validate/build | Production command/output |
| --- | --- | --- | --- |
| Backend | `npm.cmd ci` | `npm.cmd run validate` | `npm.cmd start` |
| Frontend | `npm.cmd ci` | lint, test, `npm.cmd run build` | deploy `dist` |

No root workspace package exists; run commands inside each package.

## 8. Health checks

Probe `GET /api/v1/health`.

Healthy response: HTTP 200 with `success: true`, service
`client-management-portal-api`, `status: healthy`, and `database: connected`. Database
disconnection returns HTTP 503 with `success: false`, `status: unavailable`, and
`database: disconnected`.

Use it as a readiness/startup check. Because it depends on MongoDB, do not use aggressive liveness
restart behavior that causes a restart storm during an Atlas outage. There is no separate process-
only liveness endpoint.

## 9. CORS

`CLIENT_URL` is the only allowed browser origin; requests without an Origin header are also allowed
for non-browser tooling. Credentials are enabled. Configure the exact frontend scheme, host, and
port. Do not use a wildcard origin with credentialed requests. After an origin change, update the
backend and rebuild the frontend API base as needed.

## 10. Cookies and HTTPS

Production sets the refresh cookie `Secure`, always sets `HttpOnly`, uses `SameSite=Lax`, and scopes
it to `/api/v1/auth`. HTTPS is therefore mandatory. `SameSite=Lax` is appropriate when frontend and
API are same-site (subdomains of the same registrable site are normally same-site) but may prevent
refresh cookies in a genuinely cross-site deployment. Do not assume unrelated provider domains will
work: choose aligned domains or review a deliberate cross-site cookie/CSRF design before release.

The API client always uses `credentials: include`. A reverse proxy must preserve HTTPS externally.
Do not terminate TLS and expose plain HTTP to browsers.

## 11. Reverse proxy

- Forward API paths unchanged, including `/api/v1`.
- Permit multipart bodies above 10 MiB plus encoding overhead; keep a bounded proxy limit.
- Do not buffer or publicly cache authenticated file downloads.
- Preserve/forward `X-Request-Id` or allow the backend to generate one.
- Set timeouts that permit file streaming and graceful shutdown without being unbounded.
- Redact authorization, cookie, and request-body data from proxy logs.

## 12. SPA fallback

Configure the static host to return `index.html` for React routes. Without this, client-side
navigation works but direct visits/refreshes such as `/super-admin/organizations` return the host's
404. The repository intentionally has no provider-specific fallback file.

## 13. Logging

Pino writes structured operational logs with request IDs to stdout/stderr. Collect them with the
platform, set retention/access controls, and alert on startup, shutdown, health, and 5xx events.
Never add passwords, bodies, access/refresh tokens, cookies, authorization headers, MongoDB URIs, or
file contents. Request IDs are correlation values, not credentials. Audit logging is not
implemented.

## 14. Storage backup

Back up MongoDB and `PROJECT_FILE_STORAGE_ROOT` on a coordinated schedule. Record a recovery point,
restore into an isolated environment, and verify that metadata can stream its matching binary.
Protect backups as sensitive data. Do not expose the volume through the frontend/static host.

## 15. Deployment order

1. Create the production database/user and network rules.
2. Provision and mount persistent private file storage.
3. Configure backend environment variables/secrets.
4. Install, validate, and deploy the backend.
5. Verify the health endpoint.
6. Set the frontend production API URL.
7. Install, test, and build the frontend.
8. Deploy `dist` with HTTPS and SPA fallback.
9. Confirm backend CORS uses the exact frontend origin.
10. Run smoke tests.
11. Create fictional demo data manually.

## 16. Smoke tests

- [ ] Health returns 200 and connected.
- [ ] Registration/login works and response/logs expose no refresh token.
- [ ] Browser refresh restores authentication through the cookie.
- [ ] Organization Admin can create a Client and Project.
- [ ] Approved File uploads and downloads only through an authenticated request.
- [ ] Files survive a controlled backend restart.
- [ ] Invoice creation preserves exact integer cents.
- [ ] Dashboard counts reflect the demo tenant only.
- [ ] Super Admin can view/suspend/reactivate the demo Organization.
- [ ] Super Admin and a second tenant cannot fetch the first tenant's records.
- [ ] Direct navigation to a React route returns the SPA.
- [ ] Logs carry request IDs and no credentials.

## 17. Rollback

Keep the prior application artifact and environment version available. Roll back frontend and
backend artifacts independently only when their API contracts remain compatible. Restore
environment changes carefully; never expose old secrets. The MVP does not include destructive
schema migration scripts, but database rollback still requires compatibility review. Never restore
MongoDB metadata without considering corresponding file binaries, or vice versa.

## 18. Scaling limitations

- Per-instance filesystem storage prevents safe horizontal scaling.
- No distributed cache, job queue, WebSocket, or real-time infrastructure exists.
- No CDN-backed protected File delivery exists.
- Dashboard counts query current database state.
- Access tokens are stateless and lack general immediate revocation.
- Refresh sessions are not persisted.
- The combined health endpoint couples readiness to MongoDB.

## 19. Security limitations

This deployment is not compliance-certified. There is no malware scanning, MFA, password reset,
refresh replay detection, audit-log product, rate limiter, or content-signature validation. Declared
MIME types can be spoofed. Production operators must secure secrets, TLS, DNS, database access,
volumes, backups, logs, and host patching.

