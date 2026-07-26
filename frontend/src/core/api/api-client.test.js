import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './api-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API request origin boundary', () => {
  it.each([
    'https://attacker.example/collect',
    'http://attacker.example/collect',
    '//attacker.example/collect',
    'auth/login',
  ])('rejects non-relative API path %s before fetch', async (path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest(path, { accessToken: 'private-access-token' }),
    ).rejects.toThrow('API request paths must be relative');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends credentials and an in-memory bearer token only to the configured API base', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/health', { accessToken: 'memory-token' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/health',
      expect.objectContaining({
        credentials: 'include',
        headers: { Authorization: 'Bearer memory-token' },
      }),
    );
  });
});
