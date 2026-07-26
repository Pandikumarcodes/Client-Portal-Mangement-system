# Client Management Portal

Client Management Portal is a full-stack, multi-tenant MVP for Organizations to manage Client
profiles, Projects, secure Project File delivery, Invoices, and operational count summaries. A
separate Super Admin surface provides limited Organization and tenant-user oversight without
granting access to tenant business records.

## Problem statement

Organizations often keep client records, Projects, deliverables, files, and Invoices in disconnected
tools. This MVP centralizes the core workflow while preserving tenant isolation, role-based access,
authenticated file handling, and explicit platform-versus-tenant boundaries.

## Target users

- **Organization Admin:** registers an Organization and manages its Clients, Projects, Project
  Files, Invoices, and dashboard.
- **Client:** can authenticate and reach a minimal role-specific home page. Client access to tenant
  business records is not implemented.
- **Super Admin:** views platform counts, Organizations, and safe tenant-user summaries, and can
  suspend or reactivate Organizations. This role cannot access tenant business routes.

## MVP feature summary

- Organization registration and authentication
- JWT access tokens and rotating HTTP-only refresh-token cookies
- Organization suspension with request-time checks on composed tenant routes
- Organization Admin Client and Project management, filters, and pagination
- Project-scoped secure File upload, metadata, status changes, and authenticated download
- Project-scoped USD Invoice records using integer cents
- Organization Admin current-state count dashboard
- Minimal Super Admin Organization and tenant-user oversight
- Backend and frontend automated tests, including authorization, mass-assignment, and tenant
  isolation coverage

The frontend contains Milestone screens and API helpers, but the backend has no Milestone model or
routes. Milestones are therefore not an implemented end-to-end MVP capability and dashboard
Milestone counts remain zero.

## Architecture overview

The application is a modular monolith: one deployable backend owns cohesive domain modules and a
single MongoDB connection, while one React application provides role-aware browser routes.

```text
Browser
  -> React page -> feature API module -> authenticated Fetch utility
  -> Express route -> authentication -> role -> active-tenant check
  -> Zod validation -> controller -> service -> repository -> Mongoose -> MongoDB
                                                |
                                                +-> protected filesystem adapter (Project Files)
```

Controllers translate HTTP only; services enforce ownership and map safe DTOs; repositories perform
tenant-scoped persistence; models define data invariants and indexes. `/api/v1/super-admin/*`
platform routes deliberately do not inherit tenant context or expose tenant records.

See [Architecture](docs/ARCHITECTURE.md) for the detailed design.

## Technology stack

| Area | Technology |
| --- | --- |
| Backend | Node.js ES modules, Express 5, Mongoose 9, MongoDB, Zod 4 |
| Security/operations | JWT, bcryptjs, Helmet, CORS, Pino, request IDs |
| File handling | Multer and a protected local-filesystem adapter |
| Backend tests | Vitest and Supertest |
| Frontend | React 19, Vite 8, React Router 8, native Fetch, React Context, plain CSS |
| Frontend tests | Vitest, Testing Library, jsdom, Oxlint |

Versions are lockfile-controlled. Neither package manifest declares a Node `engines` range; the
final validation was run with Node.js 24.18.0 and npm 11.16.0.

## Repository structure

```text
client-management-portal/
|-- backend/
|   |-- src/config, core, middlewares, modules, scripts
|   |-- tests/
|   |-- docs/decisions/
|   `-- storage/project-files/
|-- frontend/
|   |-- src/components, config, core, features, pages
|   |-- tests/
|   `-- docs/decisions/
|-- docs/
`-- README.md
```

## Roles and permissions

| Capability | Unauthenticated | Organization Admin | Client | Super Admin |
| --- | ---: | ---: | ---: | ---: |
| Register / log in | Yes | Yes | Yes | Yes |
| Client records | No | Manage own tenant | No | No |
| Projects | No | Manage own tenant | No | No |
| Project Files | No | Manage/download own tenant | No | No |
| Invoices | No | Manage own tenant | No | No |
| Organization dashboard | No | View own tenant | No | No |
| Platform overview / Organizations | No | No | No | View |
| Suspend/reactivate Organization | No | No | No | Yes |
| Tenant business records through platform routes | No | No | No | No |

## Local setup summary

1. Install Git, a compatible modern Node.js/npm runtime, and obtain a MongoDB Atlas SRV connection.
2. Run `npm.cmd ci` in both `backend` and `frontend`.
3. Copy each `.env.example` to `.env` and replace placeholders.
4. Start the backend with `npm.cmd run dev`, then the frontend with `npm.cmd run dev`.
5. Open `http://localhost:5173` and verify `http://localhost:5000/api/v1/health`.

Follow [Local setup](docs/LOCAL-SETUP.md) for Atlas, commands, and diagnostics.

## Environment variables

Never commit `.env` files or real credentials.

| Name | Component | Required | Safe local example | Production expectation |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Backend | Optional; defaults to development | `development` | `production` |
| `PORT` | Backend | Optional; defaults to 5000 | `5000` | Provider-assigned or configured port |
| `MONGO_URI` | Backend | Yes | Atlas placeholder from `.env.example` | Secret SRV URI for the intended database |
| `DNS_SERVERS` | Backend | Optional | empty | Leave empty unless Node DNS needs an explicit resolver |
| `CLIENT_URL` | Backend | Yes | `http://localhost:5173` | Exact HTTPS frontend origin, no path |
| `LOG_LEVEL` | Backend | Optional | `debug` | Usually `info` |
| `JWT_ACCESS_SECRET` | Backend | Yes | 32+ character placeholder | Strong unique secret |
| `JWT_REFRESH_SECRET` | Backend | Yes | different 32+ character placeholder | Strong unique secret, different from access secret |
| `PROJECT_FILE_STORAGE_ROOT` | Backend | Optional; has local default | `./storage/project-files` | Absolute or service-relative persistent writable volume |
| `VITE_API_BASE_URL` | Frontend | Yes at build time | `http://localhost:5000/api/v1` | Public HTTPS API base ending in `/api/v1`; never a secret |

## Running backend

```powershell
Set-Location backend
npm.cmd run dev
```

Production entry point:

```powershell
npm.cmd start
```

The process connects to MongoDB before listening. `SIGINT` and `SIGTERM` stop the HTTP listener and
disconnect Mongoose.

## Running frontend

```powershell
Set-Location frontend
npm.cmd run dev
```

The production bundle is created in `frontend/dist` by `npm.cmd run build`. A static host must
provide SPA fallback to `index.html`.

## Testing and validation

```powershell
Set-Location backend
npm.cmd run validate

Set-Location ..\frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The backend aggregate validation runs syntax, ESLint, Prettier check, and all Vitest tests. The
frontend has no aggregate `validate` or formatting script.

## Security summary

- Tenant IDs come from verified access tokens, never request input; tenant repositories scope
  queries by `tenantId`.
- Explicit role guards separate Organization Admin, Client, and Super Admin surfaces.
- Access tokens live in React memory; refresh tokens use an HTTP-only, scoped cookie and rotate on
  refresh.
- Strict Zod schemas and DTO mapping reduce mass assignment and internal-field exposure.
- File metadata is stored in MongoDB; generated filenames and paths remain private, and downloads
  stream through authenticated routes.
- Suspended Organizations are checked during login, refresh, and composed tenant requests.
- MIME allowlisting trusts the declared upload MIME type and is not content inspection. Antivirus
  and malware scanning are absent.
- Logout clears the cookie but does not revoke server-side refresh sessions; refresh-token replay
  prevention is not implemented.
- Access tokens are stateless. They remain cryptographically valid until their 15-minute expiry,
  although current tenant routes also check live Organization status.

This is not a compliance certification. See [Security](backend/docs/SECURITY.md) and the
[Security test matrix](docs/SECURITY-TEST-MATRIX.md).

## Deployment overview

Deploy the backend on a Node-capable service with MongoDB connectivity, exact-origin CORS, HTTPS,
and a writable persistent volume for Project Files. Build the frontend with the public API URL and
serve `frontend/dist` from an HTTPS static host with SPA fallback. Back up MongoDB metadata and file
binaries as one logical data set. See [Deployment](docs/DEPLOYMENT.md).

## Demo flow

1. Register or log in as an Organization Admin and open the dashboard.
2. Create a Client and a Project.
3. Upload an approved Project File and download it through the authenticated route.
4. Create and update an Invoice; show status filtering and pagination where data volume permits.
5. Log in as a seeded Super Admin, view Organizations, and suspend/reactivate the demo Organization.
6. Demonstrate that Super Admin is denied a tenant route.

Do not demonstrate Milestones as working end to end. Follow [Demo guide](docs/DEMO-GUIDE.md).

## Known limitations

- No payments, recurring billing, Invoice PDFs, notifications, advanced analytics, reports, or
  exports
- No antivirus/content scanning, MFA, password reset, email verification, or persistent refresh
  sessions
- Client users have only a minimal home page and no business-record workflow
- Milestone frontend is incomplete without a backend implementation
- No Organization/user deletion or Super Admin impersonation
- Local filesystem storage requires a persistent deployment volume and prevents safe per-instance
  horizontal scaling
- No forced shutdown deadline; active connections can delay process exit
- Health is a combined application/database readiness signal, not separate liveness/readiness probes

## Future improvements

Potential later work includes a backend Milestone module, object-storage adapter, persistent
refresh-session revocation, file content inspection, stronger account recovery and MFA, protected
CDN delivery, and purpose-built readiness/liveness probes. These are not implemented.

## Portfolio value

The project demonstrates modular backend layering, full-stack API integration, multi-tenant data
isolation, platform/tenant authorization boundaries, secure-by-default file delivery, integer money
modeling, structured logging, automated security tests, deployment analysis, and documented
architecture decisions.

## Documentation index

- [Local setup](docs/LOCAL-SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Manual end-to-end testing](docs/MANUAL-TESTING.md)
- [Demo guide](docs/DEMO-GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](backend/docs/SECURITY.md)
- [Security test matrix](docs/SECURITY-TEST-MATRIX.md)
- [API reference](docs/API-REFERENCE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Portfolio and interview handoff](docs/PORTFOLIO-HANDOFF.md)
- [Backend ADR directory](backend/docs/decisions/)
- [Frontend ADR directory](frontend/docs/decisions/)

