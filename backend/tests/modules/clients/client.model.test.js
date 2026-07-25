import { afterAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const connectSpy = vi.spyOn(mongoose, 'connect');
const disconnectSpy = vi.spyOn(mongoose, 'disconnect');
const clientModule = await import('../../../src/modules/clients/client.model.js');
const { Client } = clientModule;
const tenantId = new mongoose.Types.ObjectId();

const validClient = {
  tenantId,
  userId: new mongoose.Types.ObjectId(),
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'Ada@example.com',
  companyName: 'Analytical Engines',
};

const validationError = async (values) => {
  try {
    await new Client(values).validate();
  } catch (error) {
    return error;
  }
  throw new Error('Expected Client validation to fail.');
};

afterAll(() => {
  connectSpy.mockRestore();
  disconnectSpy.mockRestore();
});

describe('Client model', () => {
  it('exports a Client Mongoose model without connecting', () => {
    expect(Object.keys(clientModule)).toEqual(['Client']);
    expect(Client.prototype).toBeInstanceOf(mongoose.Model);
    expect(Client.modelName).toBe('Client');
    expect(Client.collection.name).toBe('clients');
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('validates a valid tenant-owned profile and applies defaults', async () => {
    const client = new Client(validClient);
    await expect(client.validate()).resolves.toBeUndefined();
    expect(client.status).toBe('active');
    expect(client.email).toBe('ada@example.com');
  });

  it('defines required tenant and referenced user fields', () => {
    expect(Client.schema.path('tenantId').options.ref).toBe('Organization');
    expect(Client.schema.path('userId').options.ref).toBe('User');
    expect(Client.schema.path('userId').options.default).toBeUndefined();
  });

  it('requires tenantId, names, and email', async () => {
    const error = await validationError({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'a@b.com',
    });
    expect(error.errors.tenantId).toBeDefined();
    expect(await validationError({ ...validClient, firstName: undefined })).toBeTruthy();
    expect(await validationError({ ...validClient, lastName: undefined })).toBeTruthy();
    expect(await validationError({ ...validClient, email: undefined })).toBeTruthy();
  });

  it('trims names/company and normalizes email without changing name capitalization', async () => {
    const client = new Client({
      ...validClient,
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ADA@EXAMPLE.COM ',
      companyName: ' Engines ',
    });
    await client.validate();
    expect(client.firstName).toBe('Ada');
    expect(client.lastName).toBe('Lovelace');
    expect(client.email).toBe('ada@example.com');
    expect(client.companyName).toBe('Engines');
    const withoutCompany = new Client({ ...validClient, companyName: '   ' });
    expect(withoutCompany.companyName).toBeUndefined();
  });

  it.each(['bad-email', 'missing@domain', 'has whitespace@example.com', ''])(
    'rejects invalid email %j',
    async (email) => {
      await expect(validationError({ ...validClient, email })).resolves.toBeTruthy();
    },
  );

  it('rejects oversized fields and invalid status', async () => {
    expect(await validationError({ ...validClient, firstName: 'a'.repeat(81) })).toBeTruthy();
    expect(await validationError({ ...validClient, lastName: 'a'.repeat(81) })).toBeTruthy();
    expect(
      await validationError({ ...validClient, email: `${'a'.repeat(250)}@x.com` }),
    ).toBeTruthy();
    expect(await validationError({ ...validClient, companyName: 'a'.repeat(121) })).toBeTruthy();
    expect(await validationError({ ...validClient, status: 'archived' })).toBeTruthy();
  });

  it('accepts active/inactive and optional userId', async () => {
    await expect(
      new Client({ ...validClient, status: 'active', userId: undefined }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new Client({ ...validClient, status: 'inactive', userId: undefined }).validate(),
    ).resolves.toBeUndefined();
  });

  it('uses timestamps, no version key, strict throw, and no credential fields', () => {
    expect(Client.schema.options.timestamps).toBe(true);
    expect(Client.schema.options.versionKey).toBe(false);
    expect(Client.schema.options.strict).toBe('throw');
    expect(Client.schema.path('password')).toBeUndefined();
    expect(Client.schema.path('passwordHash')).toBeUndefined();
    expect(Client.schema.path('invitationToken')).toBeUndefined();
    expect(Client.schema.path('projectIds')).toBeUndefined();
  });

  it('rejects unknown fields without database operations or fixture leakage', async () => {
    const error = await validationError({ ...validClient, unknownField: 'fixture-secret' });
    expect(error.name).toBe('StrictModeError');
    expect(error.message).not.toContain('fixture-secret');
  });

  it('defines exactly the three requested application indexes', () => {
    const indexes = Client.schema.indexes();
    expect(indexes).toHaveLength(3);
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { tenantId: 1, email: 1 },
          { unique: true, name: 'uniq_clients_tenant_email' },
        ],
        [{ tenantId: 1, createdAt: -1 }, { name: 'idx_clients_tenant_created_at' }],
        [{ userId: 1 }, { unique: true, sparse: true, name: 'uniq_clients_user_id' }],
      ]),
    );
  });
});
