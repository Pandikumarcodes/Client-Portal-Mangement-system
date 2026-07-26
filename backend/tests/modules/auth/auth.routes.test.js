import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';
import { requestIdMiddleware } from '../../../src/core/logging/request-id.js';
import { createAuthRouter } from '../../../src/modules/auth/auth.routes.js';

const organization = {
  id: 'organization-id',
  name: 'Acme',
  slug: 'acme',
  status: 'active',
  plan: 'free',
};
const user = {
  id: 'user-id',
  tenantId: 'organization-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'organization_admin',
  status: 'active',
};

const validRegistration = {
  organizationName: 'Acme Studio',
  organizationSlug: 'acme-studio',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'StrongPass1',
};
const validLogin = { email: 'ada@example.com', password: 'StrongPass1' };

const createTestApp = () => {
  const registerOrganizationAdmin = vi.fn().mockResolvedValue({
    organization,
    user,
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  });
  const loginUser = vi.fn().mockResolvedValue({
    organization,
    user,
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  });
  const refreshAuthentication = vi.fn().mockResolvedValue({
    organization,
    user,
    tokens: { accessToken: 'refreshed-access-token', refreshToken: 'refreshed-refresh-token' },
  });
  const setRefreshTokenCookie = vi.fn((response, token) => {
    response.cookie('client_portal_refresh_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  const clearRefreshTokenCookie = vi.fn((response) =>
    response.clearCookie('client_portal_refresh_token'),
  );
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      registerOrganizationAdmin,
      loginUser,
      refreshAuthentication,
      getRefreshTokenCookie: (req) => req.cookies?.client_portal_refresh_token ?? null,
      setRefreshTokenCookie,
      clearRefreshTokenCookie,
    }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, registerOrganizationAdmin, loginUser, refreshAuthentication };
};

describe('authentication routes', () => {
  let testApp;

  beforeEach(() => {
    testApp = createTestApp();
  });

  it('registers valid input and sets an HTTP-only SameSite cookie', async () => {
    const response = await request(testApp.app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.data.accessToken).toBe('access-token');
    expect(response.body).not.toHaveProperty('data.refreshToken');
    expect(response.headers['set-cookie'][0]).toContain(
      'client_portal_refresh_token=refresh-token',
    );
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rejects weak passwords and unknown registration properties before the service', async () => {
    const weak = await request(testApp.app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, password: 'weak' });
    const unknown = await request(testApp.app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, extra: true });

    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('VALIDATION_ERROR');
    expect(testApp.registerOrganizationAdmin).not.toHaveBeenCalled();
  });

  it('logs in valid input and rejects invalid login input', async () => {
    const valid = await request(testApp.app).post('/api/v1/auth/login').send(validLogin);
    const invalid = await request(testApp.app).post('/api/v1/auth/login').send({ email: 'bad' });

    expect(valid.status).toBe(200);
    expect(valid.body.data.accessToken).toBe('access-token');
    expect(valid.body).not.toHaveProperty('data.refreshToken');
    expect(valid.headers['set-cookie'][0]).toContain('client_portal_refresh_token=refresh-token');
    expect(valid.headers['cache-control']).toBe('no-store');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refreshes and rotates the cookie without returning refreshToken', async () => {
    const response = await request(testApp.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'client_portal_refresh_token=old-refresh-token');

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe('refreshed-access-token');
    expect(response.body).not.toHaveProperty('data.refreshToken');
    expect(response.headers['set-cookie'][0]).toContain('refreshed-refresh-token');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rejects refresh without a cookie and supports idempotent logout', async () => {
    const missing = await request(testApp.app).post('/api/v1/auth/refresh');
    const logout = await request(testApp.app).post('/api/v1/auth/logout');

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(logout.status).toBe(204);
    expect(logout.text).toBe('');
    expect(logout.headers['set-cookie'][0]).toContain('client_portal_refresh_token=;');
    expect(logout.headers['cache-control']).toBe('no-store');
  });

  it('returns the standard 404 response for unknown auth routes', async () => {
    const response = await request(testApp.app).get('/api/v1/auth/logout');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    await request(testApp.app).get('/api/v1/auth/refresh').expect(404);
    await request(testApp.app).get('/api/v1/auth/logout').expect(404);
  });
});
