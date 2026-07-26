import { beforeEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock('../../../src/modules/clients/client.model.js', () => ({
  Client: model,
}));

import { updateClientById } from '../../../src/modules/clients/client.repository.js';

describe('Client repository update boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  });

  it('scopes by tenant and allow-lists mutable fields', async () => {
    await updateClientById({
      tenantId: 'tenant-a',
      clientId: 'client-a',
      updates: {
        firstName: 'Ada',
        status: 'inactive',
        tenantId: 'tenant-b',
        userId: 'attacker',
        createdAt: new Date(0),
        passwordHash: 'private',
      },
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'client-a', tenantId: 'tenant-a' },
      { firstName: 'Ada', status: 'inactive' },
      { new: true, runValidators: true },
    );
  });
});
