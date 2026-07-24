import { describe, expect, it, vi } from 'vitest';

const verifyAccessToken = vi.hoisted(() => vi.fn());
vi.mock('../../../src/modules/auth/token.js', () => ({ verifyAccessToken }));

import { authenticateRequest } from '../../../src/modules/auth/auth.middleware.js';

const accessIdentity = {
  userId: 'user-id',
  role: 'client',
  tenantId: 'tenant-id',
  tokenType: 'access',
};

describe('authentication middleware', () => {
  it('creates frozen request.auth from a valid Bearer access token', () => {
    verifyAccessToken.mockReturnValue(accessIdentity);
    const request = { headers: { authorization: 'bearer access-token' } };
    const next = vi.fn();

    authenticateRequest(request, {}, next);

    expect(request.auth).toEqual({ userId: 'user-id', role: 'client', tenantId: 'tenant-id' });
    expect(Object.isFrozen(request.auth)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
  });

  it.each([undefined, '', 'Basic token', 'Bearer', 'Bearer a b'])(
    'rejects malformed authorization %j',
    (authorization) => {
      const request = { headers: authorization === undefined ? {} : { authorization } };
      const next = vi.fn();

      authenticateRequest(request, {}, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      });
    },
  );

  it('rejects invalid and refresh tokens without exposing JWT errors', () => {
    verifyAccessToken.mockReturnValue(null);
    const next = vi.fn();

    authenticateRequest({ headers: { authorization: 'Bearer invalid-token' } }, {}, next);

    expect(next.mock.calls[0][0].message).toBe('Authentication is required.');
    verifyAccessToken.mockReturnValue({ ...accessIdentity, tokenType: 'refresh' });
    const refreshNext = vi.fn();
    authenticateRequest({ headers: { authorization: 'Bearer refresh-token' } }, {}, refreshNext);
    expect(refreshNext.mock.calls[0][0].code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('forwards verification failures safely and never logs authorization values', () => {
    verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt details');
    });
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const next = vi.fn();

    authenticateRequest({ headers: { authorization: 'Bearer secret-token' } }, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0].message).not.toContain('jwt details');
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
