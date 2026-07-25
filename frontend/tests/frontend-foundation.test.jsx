import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { frontendEnv } from '../src/config/env.js';
import { apiRequest } from '../src/core/api/api-client.js';
import { ApiClientError } from '../src/core/api/api-error.js';
import { USER_ROLE } from '../src/features/auth/auth.constants.js';
import { getRoleHome } from '../src/features/auth/get-role-home.js';
import { AuthProvider } from '../src/features/auth/auth-provider.jsx';
import { AuthContext } from '../src/features/auth/auth-context.js';
import { useAuth } from '../src/features/auth/use-auth.js';
import { ProtectedRoute } from '../src/features/auth/protected-route.jsx';
import { RoleRoute } from '../src/features/auth/role-route.jsx';

const jsonResponse = (body, options = {}) => ({ ok: options.ok ?? true, status: options.status ?? 200, json: vi.fn().mockResolvedValue(body) });

describe('frontend foundation', () => {
  it('loads a normalized API base URL', () => expect(frontendEnv.apiBaseUrl).toMatch(/^https?:\/\//));

  it('builds credentialed JSON requests with optional Bearer access', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    await apiRequest('/auth/refresh', { method: 'POST', body: { ready: true }, accessToken: 'memory-token' });
    expect(fetch).toHaveBeenCalledWith(`${frontendEnv.apiBaseUrl}/auth/refresh`, expect.objectContaining({ credentials: 'include', body: '{"ready":true}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer memory-token' } }));
  });

  it('sends FormData without forcing a content type and supports Blob responses', async () => {
    const blob = new Blob(['file'], { type: 'application/pdf' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="file.pdf"' }),
      blob: vi.fn().mockResolvedValue(blob),
    });
    const body = new FormData();
    body.append('file', blob, 'file.pdf');
    const result = await apiRequest('/projects/project-1/files/file-1/download', {
      method: 'POST',
      body,
      accessToken: 'memory-token',
      responseType: 'blob',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/project-1/files/file-1/download'),
      expect.objectContaining({
        body,
        headers: { Authorization: 'Bearer memory-token' },
        credentials: 'include',
      }),
    );
    expect(result.data).toBe(blob);
  });

  it('normalizes JSON errors from failed Blob endpoints', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      error: { code: 'PROJECT_FILE_CONTENT_NOT_FOUND', message: 'Unavailable.' },
    }, { ok: false, status: 404 }));
    await expect(apiRequest('/download', {
      accessToken: 'memory-token',
      responseType: 'blob',
    })).rejects.toMatchObject({
      status: 404,
      code: 'PROJECT_FILE_CONTENT_NOT_FOUND',
    });
  });

  it('handles 204, standardized failures, network failures, and aborts safely', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeNull();
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'INVALID', message: 'Nope' } }, { ok: false, status: 400 }));
    await expect(apiRequest('/bad')).rejects.toMatchObject({ status: 400, code: 'INVALID' });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(apiRequest('/bad')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    const abort = new DOMException('aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abort);
    await expect(apiRequest('/bad')).rejects.toBe(abort);
    expect(ApiClientError).toBeDefined();
  });

  it('maps every role home and unknown roles to login', () => {
    expect(getRoleHome(USER_ROLE.SUPER_ADMIN)).toBe('/super-admin');
    expect(getRoleHome(USER_ROLE.ORGANIZATION_ADMIN)).toBe('/admin');
    expect(getRoleHome(USER_ROLE.CLIENT)).toBe('/client');
    expect(getRoleHome('unknown')).toBe('/login');
  });

  it('bootstraps AuthProvider through refresh and keeps session in memory', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { user: { role: 'client' }, organization: null, accessToken: 'memory-token' } }));
    function Probe() { const auth = useAuth(); return <div>{auth.status}:{auth.accessToken}</div>; }
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('authenticated:memory-token')).toBeInTheDocument());
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('redirects unauthenticated protected routes and allows authenticated routes', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new ApiClientError({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }));
    render(<MemoryRouter initialEntries={['/private']}><AuthProvider><Routes><Route element={<ProtectedRoute />}><Route path="/private" element={<div>Private</div>} /></Route><Route path="/login" element={<div>Login</div>} /></Routes></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
  });

  it('allows the configured role and redirects a disallowed role', () => {
    function Probe() { return <div>Allowed</div>; }
    const session = { status: 'authenticated', user: { role: 'client' }, organization: null, accessToken: 'token' };
    render(<AuthContext.Provider value={session}><MemoryRouter><Routes><Route element={<RoleRoute allowedRoles={['client']} />}><Route path="/" element={<Probe />} /></Route></Routes></MemoryRouter></AuthContext.Provider>);
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });
});
