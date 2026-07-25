import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import { createClient, getClient, listClients, updateClient } from './client-api.js';

const token = 'memory-access-token';
const client = { id: 'client-1', firstName: 'Ada' };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({ data: { client, clients: [client], pagination: { page: 1 } } });
  localStorage.clear();
  sessionStorage.clear();
});

describe('Client API operations', () => {
  it('creates a client with supported fields and the access token', async () => {
    const input = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      companyName: 'Analytical Engines',
      tenantId: 'private-tenant',
      userId: 'private-user',
      status: 'inactive',
    };
    await expect(createClient(input, token)).resolves.toEqual(client);
    expect(apiRequest).toHaveBeenCalledWith('/clients', {
      method: 'POST',
      body: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        companyName: 'Analytical Engines',
      },
      accessToken: token,
    });
  });

  it('omits a blank company name and unsupported identity fields', async () => {
    await createClient({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      companyName: '   ',
      tenantId: 'tenant',
      userId: 'user',
    }, token);
    expect(apiRequest.mock.calls[0][1].body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
  });

  it('lists with defaults, explicit pagination, and an optional status', async () => {
    await listClients({}, token);
    expect(apiRequest).toHaveBeenLastCalledWith('/clients?page=1&limit=20', { accessToken: token });
    await listClients({ page: 2, limit: 10, status: 'active' }, token);
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/clients?page=2&limit=10&status=active',
      { accessToken: token },
    );
  });

  it('omits undefined status', async () => {
    await listClients({ page: 3, limit: 20, status: undefined }, token);
    expect(apiRequest.mock.calls[0][0]).toBe('/clients?page=3&limit=20');
  });

  it('encodes the client ID and passes the access token', async () => {
    await getClient('client/id ? value', token);
    expect(apiRequest).toHaveBeenCalledWith('/clients/client%2Fid%20%3F%20value', {
      accessToken: token,
    });
  });

  it('updates with supported fields only and can clear company name', async () => {
    await updateClient('client/id', {
      firstName: 'Grace',
      companyName: null,
      status: 'inactive',
      tenantId: 'tenant',
      userId: 'user',
      arbitrary: true,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/clients/client%2Fid', {
      method: 'PATCH',
      body: { firstName: 'Grace', companyName: null, status: 'inactive' },
      accessToken: token,
    });
  });

  it.each([
    ['createClient', () => createClient({}, '')],
    ['listClients', () => listClients({}, ' ')],
    ['getClient', () => getClient('id', null)],
    ['updateClient', () => updateClient('id', {}, undefined)],
  ])('%s requires a non-empty access token', async (_name, operation) => {
    await expect(operation()).rejects.toThrow('An access token is required.');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not log tokens or use browser storage', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await createClient({ firstName: 'A', lastName: 'B', email: 'a@b.com' }, token);
    expect(log).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    log.mockRestore();
  });
});
