import { describe, expect, it } from 'vitest';
import {
  clientIdParamsSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from '../../../src/modules/clients/client.schemas.js';

const valid = {
  firstName: ' Ada ',
  lastName: ' Lovelace ',
  email: ' ADA@EXAMPLE.COM ',
  companyName: ' Engines ',
};
describe('Client request schemas', () => {
  it('normalizes valid create input and rejects protected fields', () => {
    expect(createClientSchema.parse(valid)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      companyName: 'Engines',
    });
    expect(createClientSchema.parse({ ...valid, companyName: '   ' }).companyName).toBeUndefined();
    expect(() => createClientSchema.parse({ ...valid, tenantId: 'tenant' })).toThrow();
    expect(() => createClientSchema.parse({ ...valid, status: 'inactive' })).toThrow();
  });
  it('validates updates, clearing, IDs, and list defaults', () => {
    expect(updateClientSchema.parse({ companyName: null })).toEqual({ companyName: null });
    expect(() => updateClientSchema.parse({})).toThrow();
    expect(clientIdParamsSchema.parse({ clientId: 'ABCDEFabcdef123456789012' }).clientId).toBe(
      'abcdefabcdef123456789012',
    );
    expect(listClientsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listClientsQuerySchema.parse({ page: '2', limit: '50', status: 'inactive' })).toEqual({
      page: 2,
      limit: 50,
      status: 'inactive',
    });
    expect(() => listClientsQuerySchema.parse({ limit: 51 })).toThrow();
  });
});
