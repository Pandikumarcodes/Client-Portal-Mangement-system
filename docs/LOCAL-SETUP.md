# Local development setup

PowerShell is the primary command environment. On macOS/Linux, use the equivalent `cp`, `cd`, and
`npm` commands instead of `Copy-Item`, `Set-Location`, and `npm.cmd`.

## 1. Prerequisites

- Git
- Node.js and npm compatible with the lockfiles
- MongoDB Atlas account and cluster reachable through an SRV URI
- Modern browser
- Windows PowerShell

The manifests do not declare `engines`. Prompt 30E validation used Node.js 24.18.0 and npm 11.16.0;
use that known-good major or independently validate another runtime with both package test suites.

## 2. Clone

```powershell
git clone https://example.com/your-account/client-management-portal.git
Set-Location client-management-portal
```

Replace the placeholder URL with the repository URL. Do not place credentials in a clone URL.

## 3. Install backend and frontend

Both packages have tracked lockfiles, so a clean, reproducible installation should use `npm.cmd ci`.
It removes and recreates that package's `node_modules`.

```powershell
Set-Location backend
npm.cmd ci

Set-Location ..\frontend
npm.cmd ci
Set-Location ..
```

Use `npm.cmd install` only when intentionally changing dependencies and the lockfile.

## 4. MongoDB Atlas setup

1. Create an Atlas project and cluster.
2. Create a database user with only the access the application needs.
3. Add the developer machine's current IP in Atlas Network Access. Do not use unrestricted access
   for a shared or production environment.
4. Copy the driver connection string in `mongodb+srv://...` form.
5. Replace username, password, cluster host, and database name placeholders.
6. URL-encode special password characters such as `@`, `:`, `/`, `%`, and `#`.
7. Use an explicit database name such as `client_management_portal` to avoid writing to an
   unintended sample/default database.

The current backend validator requires an SRV URI. A non-SRV `mongodb://` URI is rejected even if
the underlying MongoDB deployment is otherwise compatible.

## 5. Environment files

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `backend/.env`:

- `MONGO_URI`: real developer-owned Atlas SRV URI
- `CLIENT_URL`: exact frontend origin, normally `http://localhost:5173`
- `JWT_ACCESS_SECRET`: unique random value of at least 32 characters
- `JWT_REFRESH_SECRET`: different unique random value of at least 32 characters
- `PROJECT_FILE_STORAGE_ROOT`: writable location; the safe local default is
  `./storage/project-files`
- `NODE_ENV`, `PORT`, `DNS_SERVERS`, and `LOG_LEVEL`: optional operational settings as shown in the
  example

Edit `frontend/.env`:

- `VITE_API_BASE_URL=http://localhost:5000/api/v1`

Vite variables are compiled into browser assets. Never put secrets in `VITE_*` variables.

## 6. Verify database connectivity

From `backend`:

```powershell
npm.cmd run db:dns-check
npm.cmd run db:check
```

The DNS preflight verifies SRV lookup only and prints safe diagnostics. The database check attempts
a real Mongoose connection and disconnect. `DNS_SERVERS` should normally remain empty; configure it
only if Node's resolver cannot resolve the Atlas SRV record.

## 7. Start the backend

```powershell
Set-Location backend
npm.cmd run dev
```

The backend connects to MongoDB before listening. Default API origin:
`http://localhost:5000`.

## 8. Start the frontend

In another PowerShell window:

```powershell
Set-Location frontend
npm.cmd run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## 9. Verify health

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:5000/api/v1/health
```

Expected while MongoDB is connected: HTTP 200, `success: true`, `status: healthy`, and
`database: connected`. HTTP 503 means the process is reachable but MongoDB is not ready. This is a
combined readiness-style check, not a separate liveness probe.

## 10. Register and log in

Browser registration is available at `/register`. A safe API example:

```powershell
$body = @{
  organizationName = "Northstar Studio"
  organizationSlug = "northstar-studio-local"
  firstName = "Avery"
  lastName = "Morgan"
  email = "avery.admin@example.test"
  password = "LocalOnly9Pass"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://localhost:5000/api/v1/auth/register `
  -ContentType "application/json" `
  -SessionVariable session `
  -Body $body
```

Use fictional, disposable local data. `Invoke-RestMethod` returns the access token in the response
and stores the HTTP-only refresh cookie in `$session`; do not paste either into logs or commits.

## 11. Tests, lint, formatting, and builds

Backend:

```powershell
Set-Location backend
npm.cmd run check:syntax
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run validate
```

Frontend:

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`preview` is for locally inspecting the built SPA, not a production server. The frontend has no
format or aggregate validation script.

## 12. Stop services

Press `Ctrl+C` in each terminal. The backend handles `SIGINT`/`SIGTERM`, closes the HTTP listener,
and disconnects MongoDB. It has no forced shutdown deadline, so a long-lived active connection can
delay exit.

## 13. Common local errors

| Symptom | Check |
| --- | --- |
| `MONGO_URI` invalid/missing | Copy the example and use a complete `mongodb+srv://` URI |
| Invalid Atlas host | Re-copy the driver URI; do not invent the cluster hostname |
| SRV/DNS failure | Run `db:dns-check`; inspect Node resolvers and use `DNS_SERVERS` only if needed |
| CORS failure | `CLIENT_URL` must exactly match the browser origin |
| Invalid frontend API configuration | Set an absolute HTTP(S) `VITE_API_BASE_URL`, then restart Vite |
| Wrong API path / `RESOURCE_NOT_FOUND` | Include `/api/v1` in the frontend API base |
| Port in use | Stop the other process or safely choose another matching port/API base |
| Refresh cookie absent | Use the exact frontend origin, `credentials: include`, and compatible cookie/HTTP settings |
| Storage permission failure | Use an existing/writable parent and a non-root storage path |
| Upload rejected | Use one allowlisted file no larger than 10 MiB |
| Build fails after `.env` change | Stop and restart Vite; build-time variables are not live-reloaded reliably |

See [Troubleshooting](TROUBLESHOOTING.md) for diagnostics and safe fixes.

## 14. Credential handling

- `.env` files are ignored; verify with `git status --ignored`.
- Never commit Atlas credentials, JWT secrets, tokens, cookies, or demo passwords.
- Do not share raw database errors or connection strings in screenshots.
- Rotate any credential that may have entered Git history; deleting it from the current file does
  not remove it from history.
- Keep production and local credentials separate.

