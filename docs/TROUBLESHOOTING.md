# Troubleshooting

Use diagnostics in a local or dedicated non-production environment. Never paste `.env`, tokens,
cookies, credentials, raw MongoDB errors, or private file paths into tickets. A fix should not weaken
validation, CORS, cookies, tenant scoping, or storage privacy.

## 1. Installation

### Node or npm is not recognized

- **Symptom:** PowerShell cannot find `node`, `npm`, or `npm.cmd`.
- **Cause:** Node.js is absent or not in `PATH`.
- **Diagnostic:** `Get-Command node`; `node --version`; `npm.cmd --version`.
- **Fix:** install a supported Node release, reopen PowerShell, and use the known validated runtime
  (Node 24.18.0) when uncertain.
- **Do not:** download executables from unofficial mirrors or bypass lockfiles.

### `npm ci` fails

- **Symptom:** lock mismatch, engine error, or dependency extraction failure.
- **Cause:** wrong directory/runtime, edited lockfile, network/cache/permission problem.
- **Diagnostic:** verify `Get-Location`, Node/npm versions, and tracked `package-lock.json`.
- **Fix:** use each package directory and a compatible runtime; retry the documented command.
- **Do not:** delete/change lockfiles or run audit-force updates merely to make a demo start.

## 2. Environment configuration

### Invalid backend environment / `MONGO_URI` undefined

- **Symptom:** startup reports only invalid environment field names.
- **Cause:** missing `backend/.env`, incomplete values, equal/short JWT secrets, non-SRV URI.
- **Diagnostic:** compare variable names with `.env.example` without printing values.
- **Fix:** copy the example and replace every required placeholder.
- **Do not:** weaken `src/config/env.js` or commit `.env`.

### Missing/invalid `VITE_API_BASE_URL`

- **Symptom:** frontend throws `Invalid frontend API configuration.`
- **Cause:** missing value or a non-absolute/non-HTTP(S) URL.
- **Diagnostic:** compare `frontend/.env` with `.env.example`.
- **Fix:** use `http://localhost:5000/api/v1` locally and restart Vite.
- **Do not:** put secrets in `VITE_*` variables or add a hard-coded fallback.

## 3. MongoDB

### Invalid Atlas host / connection failure

- **Symptom:** `db:check` fails with a safe diagnostic category.
- **Cause:** invented/stale host, wrong database user/password, IP rules, or cluster state.
- **Diagnostic:** run `npm.cmd run db:dns-check`, then `npm.cmd run db:check`.
- **Fix:** re-copy the Atlas driver SRV URI, URL-encode credentials, verify database name/user/network.
- **Do not:** publish the URI or broadly allow all networks in production.

## 4. DNS

### SRV `ECONNREFUSED` / Node resolver uses loopback

- **Symptom:** DNS preflight cannot resolve `_mongodb._tcp`; diagnostic warns about loopback.
- **Cause:** VPN/security software/local stub resolver or Node resolver configuration.
- **Diagnostic:** `npm.cmd run db:dns-check`; inspect its safe resolver/category output.
- **Fix:** repair the OS/network DNS path, or set `DNS_SERVERS` for this Node process only when an
  approved resolver is required.
- **Do not:** edit machine DNS blindly, hard-code `dns.setServers()` in application modules, or use
  this fix for credential/IP-access failures.

## 5. Backend startup

### Port already in use

- **Symptom:** startup fails before serving.
- **Cause:** another process owns `PORT`.
- **Diagnostic:** `Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue`.
- **Fix:** stop the known process or choose another backend port and update frontend API base.
- **Do not:** terminate unknown processes without identifying ownership.

### Health returns 503

- **Symptom:** process responds but reports database disconnected.
- **Cause:** MongoDB not ready.
- **Diagnostic:** run the database checks and inspect safe application logs/request ID.
- **Fix:** restore database connectivity; allow readiness to recover.
- **Do not:** change health to 200 or use aggressive liveness restarts during an Atlas outage.

## 6. Frontend startup

### Page cannot load API after `.env` edit

- **Symptom:** requests still use the old URL.
- **Cause:** Vite environment is loaded at process/build start.
- **Diagnostic:** inspect browser request origin (not headers/tokens).
- **Fix:** stop and restart dev server or rebuild assets.
- **Do not:** log complete requests or tokens.

### `RESOURCE_NOT_FOUND`

- **Symptom:** every expected API call returns a safe 404.
- **Cause:** wrong base/path, commonly missing `/api/v1`.
- **Diagnostic:** compare browser URL with [API reference](API-REFERENCE.md).
- **Fix:** set base to the API origin plus `/api/v1`, without duplicating it.
- **Do not:** add duplicate backend routes to compensate.

## 7. Authentication

### Session does not restore

- **Symptom:** refresh after login returns to login or shows restore error.
- **Cause:** missing/blocked cookie, expired/invalid refresh token, Organization suspension, origin
  mismatch.
- **Diagnostic:** inspect cookie presence/flags in browser devtools without copying its value; call
  health; inspect safe response code.
- **Fix:** align origin/cookie settings, log in again, or reactivate only an intentionally suspended
  test Organization.
- **Do not:** move tokens to localStorage or make the refresh cookie readable by JavaScript.

## 8. CORS

### Origin mismatch

- **Symptom:** browser blocks API response; command-line API call may work.
- **Cause:** `CLIENT_URL` differs by scheme, host, or port.
- **Diagnostic:** compare the browser's exact origin with `CLIENT_URL`.
- **Fix:** set one exact origin and restart backend.
- **Do not:** use `*` with credentials or reflect arbitrary origins.

## 9. Cookies

### Refresh cookie not sent / secure cookie on local HTTP

- **Symptom:** `/auth/refresh` returns 401 after successful login.
- **Cause:** production mode on plain HTTP, incompatible cross-site deployment, wrong path/domain,
  or credential mode.
- **Diagnostic:** inspect cookie flags and request cookie presence in browser devtools.
- **Fix:** use HTTPS in production; locally use development mode and matching localhost origins.
- **Do not:** disable `HttpOnly`/`Secure` in production or assume unrelated domains work with
  `SameSite=Lax`.

## 10. File upload

### Storage root unavailable

- **Symptom:** upload returns a safe server/storage failure.
- **Cause:** missing mount, read-only path, bad permissions, or exhausted capacity.
- **Diagnostic:** verify the resolved deployment mount and service-account write access without
  exposing stored names.
- **Fix:** mount/provision the configured private persistent volume and restore permissions/capacity.
- **Do not:** point storage at a filesystem root, frontend `dist`, or public static directory.

### Unsupported MIME or file too large

- **Symptom:** 415 `PROJECT_FILE_TYPE_NOT_ALLOWED` or 413 `PROJECT_FILE_TOO_LARGE`.
- **Cause:** browser/client-declared MIME is not allowlisted or file exceeds 10 MiB.
- **Diagnostic:** inspect safe file type/size locally.
- **Fix:** use one genuinely supported PDF, PNG, JPEG, TXT, CSV, DOCX, or XLSX within the limit.
- **Do not:** rename extensions/spoof MIME or increase limits without security/product review.

## 11. File download

### Metadata exists but content is missing

- **Symptom:** `PROJECT_FILE_CONTENT_NOT_FOUND`.
- **Cause:** volume was not persisted/restored or metadata/binary backups diverged.
- **Diagnostic:** compare backup/release/mount timing; do not expose the private path.
- **Fix:** restore the matching binary from the coordinated backup.
- **Do not:** create a dummy file, expose storage publicly, or delete metadata in production.

### Cross-tenant/public download fails

- **Symptom:** 401/403/404.
- **Cause:** expected security boundary.
- **Diagnostic:** confirm identity/role/tenant and use the authenticated route.
- **Fix:** authenticate as the owning Organization Admin.
- **Do not:** add public/signed links or weaken scoping as troubleshooting.

## 12. Tests

### Backend/frontend tests fail

- **Symptom:** Vitest failures or hangs.
- **Cause:** wrong package/runtime, changed contract, unclean generated state.
- **Diagnostic:** run the single package's real script and read the first causal failure.
- **Fix:** correct the implementation/test contract; ensure no permanent listener is running.
- **Do not:** skip/delete tests, increase timeouts blindly, or connect offline tests to production.

## 13. Build

### Vite build or lint fails

- **Symptom:** `npm.cmd run build` or `lint` exits nonzero.
- **Cause:** missing API variable, incompatible Node, syntax/import/lint defect.
- **Diagnostic:** verify Node/version/env, then run lint and build separately.
- **Fix:** correct the reported source/configuration and rerun tests.
- **Do not:** deploy stale `dist`, disable lint rules wholesale, or commit generated output.

## 14. Deployment

### Direct React route returns host 404

- **Symptom:** navigation works, refresh/direct URL fails.
- **Cause:** no SPA fallback.
- **Diagnostic:** request `/projects/example` directly from the static host.
- **Fix:** configure unknown application routes to return `index.html`.
- **Do not:** add matching server files for every client route or proxy frontend paths to the API.

### Files disappear after deploy

- **Symptom:** metadata remains, downloads return content missing.
- **Cause:** ephemeral/local per-release filesystem.
- **Diagnostic:** verify `PROJECT_FILE_STORAGE_ROOT` mount persistence.
- **Fix:** mount persistent storage and restore coordinated backup.
- **Do not:** claim horizontal scaling with independent local volumes.

## 15. Git

### Nested backend `.git` / backend tracked as submodule

- **Symptom:** backend contents do not appear normally; Git shows a gitlink/submodule.
- **Cause:** a repository was initialized inside `backend` or staged as a gitlink.
- **Diagnostic:** `Get-ChildItem -Recurse -Force -Directory -Filter .git`; `git ls-files --stage
  backend`.
- **Fix:** stop and back up work; correct the repository structure deliberately. Removing nested Git
  metadata or changing the index can be destructive and requires explicit review/approval.
- **Do not:** run recursive deletion, `git rm`, history rewrite, reset, or checkout commands blindly.

### Uncommitted generated files

- **Symptom:** `dist`, coverage, runtime Files, `.env`, or downloads appear in status.
- **Cause:** missing/misplaced ignore rule or output outside expected path.
- **Diagnostic:** `git status --short --ignored`; `git check-ignore -v <path>`.
- **Fix:** move/delete only confirmed disposable local artifacts or add a narrowly justified ignore
  rule.
- **Do not:** delete user `.env` or uploaded data, or assume every untracked file is disposable.

### Diff/line-ending failures

- **Symptom:** `git diff --check` reports whitespace or entire files appear changed.
- **Cause:** trailing whitespace or line-ending conversion.
- **Diagnostic:** `git diff --check`; `git config --get core.autocrlf`.
- **Fix:** preserve repository convention and correct only reported lines.
- **Do not:** run a repository-wide line-ending rewrite during deployment preparation.

