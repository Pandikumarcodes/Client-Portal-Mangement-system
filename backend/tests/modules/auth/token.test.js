import { readFileSync } from 'node:fs';

import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

const { accessSecret, refreshSecret } = vi.hoisted(() => ({
  accessSecret: 'access-secret-for-token-tests-with-32-chars',
  refreshSecret: 'refresh-secret-for-token-tests-32-chars',
}));

vi.mock('../../../src/config/env.js', () => ({
  env: Object.freeze({
    jwtAccessSecret: accessSecret,
    jwtRefreshSecret: refreshSecret,
  }),
}));

import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../../src/modules/auth/token.js';

const superAdmin = { userId: '507f1f77bcf86cd799439011', role: 'super_admin' };
const tenantUser = {
  userId: '507f1f77bcf86cd799439012',
  role: 'organization_admin',
  tenantId: '507f1f77bcf86cd799439013',
};

describe('JWT token utilities', () => {
  it('exports exactly the four token operations', async () => {
    const tokenModule = await import('../../../src/modules/auth/token.js');

    expect(Object.keys(tokenModule).sort()).toEqual([
      'createAccessToken',
      'createRefreshToken',
      'verifyAccessToken',
      'verifyRefreshToken',
    ]);
  });

  it('creates JWT access and refresh token strings', () => {
    expect(createAccessToken(superAdmin)).toMatch(/^eyJ/);
    expect(createRefreshToken(superAdmin)).toMatch(/^eyJ/);
  });

  it('verifies valid access and refresh tokens', () => {
    const accessToken = createAccessToken(superAdmin);
    const refreshToken = createRefreshToken(superAdmin);

    expect(verifyAccessToken(accessToken)).toEqual({
      userId: superAdmin.userId,
      role: superAdmin.role,
      tokenType: 'access',
    });
    expect(verifyRefreshToken(refreshToken)).toEqual({
      userId: superAdmin.userId,
      role: superAdmin.role,
      tokenType: 'refresh',
      jti: expect.any(String),
    });
  });

  it('returns frozen normalized verification objects', () => {
    expect(Object.isFrozen(verifyAccessToken(createAccessToken(superAdmin)))).toBe(true);
    expect(Object.isFrozen(verifyRefreshToken(createRefreshToken(superAdmin)))).toBe(true);
  });

  it('preserves user identity and tenant membership', () => {
    expect(verifyAccessToken(createAccessToken(tenantUser))).toEqual({
      userId: tenantUser.userId,
      role: tenantUser.role,
      tenantId: tenantUser.tenantId,
      tokenType: 'access',
    });
  });

  it('omits tenantId for Super Admin tokens', () => {
    const decoded = jwt.decode(createAccessToken(superAdmin));

    expect(decoded).not.toHaveProperty('tenantId');
    expect(verifyAccessToken(createAccessToken(superAdmin))).not.toHaveProperty('tenantId');
  });

  it.each(['organization_admin', 'client'])('requires tenantId for %s', (role) => {
    expect(() => createAccessToken({ userId: superAdmin.userId, role })).toThrow(TypeError);
  });

  it('rejects Super Admin identities with tenantId', () => {
    expect(() => createAccessToken({ ...superAdmin, tenantId: tenantUser.tenantId })).toThrow(
      TypeError,
    );
  });

  it('rejects invalid roles and empty user IDs', () => {
    expect(() => createAccessToken({ userId: superAdmin.userId, role: 'owner' })).toThrow(
      TypeError,
    );
    expect(() => createAccessToken({ userId: '', role: superAdmin.role })).toThrow(TypeError);
    expect(() => createAccessToken({ role: superAdmin.role })).toThrow(TypeError);
  });

  it('does not promote additional identity properties into claims', () => {
    const token = createAccessToken({
      ...tenantUser,
      email: 'person@example.com',
      name: 'Private Person',
      passwordHash: 'never-a-claim',
      organization: { name: 'Private Organization' },
      arbitrary: 'ignored',
    });
    const payload = jwt.decode(token);

    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('passwordHash');
    expect(payload).not.toHaveProperty('organization');
    expect(payload).not.toHaveProperty('arbitrary');
  });

  it('uses separate secrets for access and refresh tokens', () => {
    const accessToken = createAccessToken(superAdmin);
    const refreshToken = createRefreshToken(superAdmin);

    expect(verifyRefreshToken(accessToken)).toBeNull();
    expect(verifyAccessToken(refreshToken)).toBeNull();
  });

  it('adds a UUID jti only to refresh tokens', () => {
    const refreshPayload = jwt.decode(createRefreshToken(superAdmin));
    const accessPayload = jwt.decode(createAccessToken(superAdmin));

    expect(refreshPayload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(accessPayload).not.toHaveProperty('jti');
  });

  it('sets the required issuer, audience, algorithm, and lifetimes', () => {
    const accessPayload = jwt.decode(createAccessToken(superAdmin));
    const refreshPayload = jwt.decode(createRefreshToken(superAdmin));

    expect(accessPayload.iss).toBe('client-management-portal-api');
    expect(accessPayload.aud).toBe('client-management-portal');
    expect(accessPayload.exp - accessPayload.iat).toBe(15 * 60);
    expect(refreshPayload.exp - refreshPayload.iat).toBe(7 * 24 * 60 * 60);
    expect(jwt.decode(createAccessToken(superAdmin), { complete: true }).header.alg).toBe('HS256');
  });

  it.each([undefined, null, 42, {}, []])('rejects non-string token input %j', (token) => {
    expect(() => verifyAccessToken(token)).toThrow(TypeError);
  });

  it('rejects empty verification input', () => {
    expect(() => verifyAccessToken('')).toThrow('Token must be a non-empty string.');
    expect(() => verifyRefreshToken('')).toThrow('Token must be a non-empty string.');
  });

  it('returns null for tampered, malformed, and expired tokens', () => {
    const token = createAccessToken(superAdmin);
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    const expiredToken = jwt.sign(
      { sub: superAdmin.userId, role: superAdmin.role, tokenType: 'access' },
      accessSecret,
      {
        algorithm: 'HS256',
        issuer: 'client-management-portal-api',
        audience: 'client-management-portal',
        expiresIn: -1,
      },
    );

    expect(verifyAccessToken(tamperedToken)).toBeNull();
    expect(verifyAccessToken('not-a-jwt')).toBeNull();
    expect(verifyAccessToken(expiredToken)).toBeNull();
  });

  it('returns null for incorrect issuer and audience', () => {
    const options = {
      algorithm: 'HS256',
      audience: 'client-management-portal',
      expiresIn: '15m',
    };
    const wrongIssuer = jwt.sign(
      { sub: superAdmin.userId, role: superAdmin.role, tokenType: 'access' },
      accessSecret,
      { ...options, issuer: 'other-api' },
    );
    const wrongAudience = jwt.sign(
      { sub: superAdmin.userId, role: superAdmin.role, tokenType: 'access' },
      accessSecret,
      { ...options, issuer: 'client-management-portal-api', audience: 'other-client' },
    );

    expect(verifyAccessToken(wrongIssuer)).toBeNull();
    expect(verifyAccessToken(wrongAudience)).toBeNull();
  });

  it('returns null for an incorrect token type', () => {
    const wrongType = jwt.sign(
      { sub: superAdmin.userId, role: superAdmin.role, tokenType: 'refresh' },
      accessSecret,
      {
        algorithm: 'HS256',
        issuer: 'client-management-portal-api',
        audience: 'client-management-portal',
        expiresIn: '15m',
      },
    );

    expect(verifyAccessToken(wrongType)).toBeNull();
  });

  it('does not expose secrets or log tokens and does not access the database', () => {
    const tokenSource = readFileSync(
      new URL('../../../src/modules/auth/token.js', import.meta.url),
      'utf8',
    );
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => createAccessToken({ userId: '', role: 'invalid' })).toThrow();
    expect(() => verifyAccessToken('bad-token')).not.toThrow();
    expect(tokenSource).not.toContain('process.env');
    expect(tokenSource).not.toContain('mongoose');
    expect(tokenSource).not.toContain('User');
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(accessSecret).not.toContain('Token identity');

    consoleLog.mockRestore();
    consoleError.mockRestore();
  });
});
