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
