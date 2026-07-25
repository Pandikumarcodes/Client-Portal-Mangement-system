import { describe, expect, it, vi } from 'vitest';
import {
  createTenantClient,
  listTenantClients,
  updateTenantClient,
} from '../../../src/modules/clients/client.service.js';

const record = {
  _id: 'client-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  status: 'active',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
describe('Client service', () => {
  it('returns a safe DTO and scopes creation', async () => {
    const createClient = vi.fn().mockResolvedValue(record);
    const result = await createTenantClient(
      { tenantId: 'tenant-id', firstName: 'Ada' },
      { createClient },
    );
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-id' }));
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('userId');
    expect(result.id).toBe('client-id');
  });
  it('maps listing pagination and clears null companyName on update', async () => {
    const findClients = vi.fn().mockResolvedValue({ clients: [record], total: 3 });
    const updateClientById = vi.fn().mockResolvedValue(record);
    const listed = await listTenantClients(
      { tenantId: 'tenant-id', page: 2, limit: 2 },
      { findClients },
    );
    expect(listed.pagination.totalPages).toBe(2);
    expect(findClients).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-id' }));
    await updateTenantClient(
      {
        tenantId: 'tenant-id',
        clientId: 'client-id',
        updates: { companyName: null, tenantId: 'bad' },
      },
      { updateClientById },
    );
    expect(updateClientById.mock.calls[0][0].updates).toEqual({ companyName: undefined });
  });
  it('translates duplicate emails', async () => {
    await expect(
      createTenantClient(
        { tenantId: 'tenant-id' },
        {
          createClient: vi
            .fn()
            .mockRejectedValue({ code: 11000, keyPattern: { tenantId: 1, email: 1 } }),
        },
      ),
    ).rejects.toMatchObject({ code: 'CLIENT_EMAIL_ALREADY_IN_USE', statusCode: 409 });
  });
});
