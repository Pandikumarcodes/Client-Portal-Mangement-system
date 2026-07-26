import { describe, expect, it, vi } from 'vitest';

import {
  createRequireActiveTenantContext,
  requireRoles,
  requireTenantContext,
} from '../../../src/modules/auth/auth.authorization.js';

describe('authentication authorization middleware', () => {
  it('validates requireRoles configuration', () => {
    expect(() => requireRoles()).toThrow(TypeError);
    expect(() => requireRoles('unknown')).toThrow(TypeError);
  });

  it('allows configured roles and rejects disallowed roles', () => {
    const next = vi.fn();
    requireRoles('client')({ auth: { role: 'client' } }, {}, next);
    expect(next).toHaveBeenCalledOnce();

    const forbiddenNext = vi.fn();
    requireRoles('client')({ auth: { role: 'super_admin' } }, {}, forbiddenNext);
    expect(forbiddenNext.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('requires authentication before role checks', () => {
    const next = vi.fn();
    requireRoles('client')({}, {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it.each(['organization_admin', 'client'])('accepts tenant context for %s', (role) => {
    const next = vi.fn();
    requireTenantContext(
      {
        auth: { role, tenantId: 'tenant-id' },
        body: { tenantId: 'other' },
        query: { tenantId: 'other' },
        params: { tenantId: 'other' },
        headers: { 'x-tenant-id': 'other' },
      },
      {},
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects Super Admin, missing tenant IDs, and missing auth', () => {
    for (const request of [{ auth: { role: 'super_admin' } }, { auth: { role: 'client' } }, {}]) {
      const next = vi.fn();
      requireTenantContext(request, {}, next);
      expect(next.mock.calls[0][0]).toMatchObject({
        code: request.auth ? 'FORBIDDEN' : 'AUTHENTICATION_REQUIRED',
      });
    }
  });

  it('does not log or trust client-supplied tenant values', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const next = vi.fn();
    requireTenantContext(
      {
        auth: { role: 'client', tenantId: 'verified-tenant' },
        body: { tenantId: 'client-tenant' },
      },
      {},
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });

  it('enforces the current Organization status for tenant requests', async () => {
    const activeLookup = vi.fn().mockResolvedValue({ status: 'active' });
    const activeNext = vi.fn();
    await createRequireActiveTenantContext({ findOrganizationById: activeLookup })(
      { auth: { role: 'organization_admin', tenantId: 'trusted-tenant' } },
      {},
      activeNext,
    );

    expect(activeLookup).toHaveBeenCalledWith('trusted-tenant');
    expect(activeNext).toHaveBeenCalledWith();

    for (const organization of [{ status: 'suspended' }, null]) {
      const next = vi.fn();
      await createRequireActiveTenantContext({
        findOrganizationById: vi.fn().mockResolvedValue(organization),
      })({ auth: { role: 'organization_admin', tenantId: 'trusted-tenant' } }, {}, next);
      expect(next.mock.calls[0][0]).toMatchObject({
        code: organization ? 'ORGANIZATION_SUSPENDED' : 'AUTHENTICATION_REQUIRED',
      });
    }
  });

  it('does not query Organizations for unauthenticated or Super Admin requests', async () => {
    for (const request of [{}, { auth: { role: 'super_admin' } }]) {
      const findOrganizationById = vi.fn();
      const next = vi.fn();
      await createRequireActiveTenantContext({ findOrganizationById })(request, {}, next);
      expect(findOrganizationById).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toMatchObject({
        code: request.auth ? 'FORBIDDEN' : 'AUTHENTICATION_REQUIRED',
      });
    }
  });
});
