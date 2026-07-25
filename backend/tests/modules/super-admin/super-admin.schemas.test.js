import { describe, expect, it } from 'vitest';

import {
  listOrganizationsQuerySchema,
  listOrganizationUsersQuerySchema,
  organizationParamsSchema,
  updateOrganizationStatusSchema,
} from '../../../src/modules/super-admin/super-admin.schemas.js';

describe('Super Admin request schemas', () => {
  it('normalizes valid Organization IDs and rejects invalid or unknown params safely', () => {
    expect(organizationParamsSchema.parse({ organizationId: 'ABCDEFABCDEFABCDEFABCDEF' })).toEqual({
      organizationId: 'abcdefabcdefabcdefabcdef',
    });
    const result = organizationParamsSchema.safeParse({ organizationId: 'secret-invalid-id' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).not.toContain('secret-invalid-id');
    expect(
      organizationParamsSchema.safeParse({
        organizationId: 'abcdefabcdefabcdefabcdef',
        tenantId: 'ignored',
      }).success,
    ).toBe(false);
  });

  it('parses Organization list defaults, filters, and boundaries', () => {
    expect(listOrganizationsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      listOrganizationsQuerySchema.parse({ page: '2', limit: '50', status: 'active' }),
    ).toEqual({ page: 2, limit: 50, status: 'active' });
    expect(listOrganizationsQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(listOrganizationsQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
    expect(listOrganizationsQuerySchema.safeParse({ tenantId: 'tenant' }).success).toBe(false);
  });

  it.each(['active', 'suspended'])('accepts the %s status update', (status) => {
    expect(updateOrganizationStatusSchema.parse({ status })).toEqual({ status });
  });

  it('rejects empty, arbitrary, and over-posted status updates', () => {
    expect(updateOrganizationStatusSchema.safeParse({}).success).toBe(false);
    expect(updateOrganizationStatusSchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(
      updateOrganizationStatusSchema.safeParse({ status: 'active', tenantId: 'tenant' }).success,
    ).toBe(false);
  });

  it('parses supported Organization user filters and excludes Super Admin', () => {
    expect(listOrganizationUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      listOrganizationUsersQuerySchema.parse({
        page: '2',
        limit: '50',
        role: 'organization_admin',
        status: 'invited',
      }),
    ).toEqual({ page: 2, limit: 50, role: 'organization_admin', status: 'invited' });
    expect(listOrganizationUsersQuerySchema.safeParse({ role: 'super_admin' }).success).toBe(false);
    expect(listOrganizationUsersQuerySchema.safeParse({ search: 'private' }).success).toBe(false);
  });
});
