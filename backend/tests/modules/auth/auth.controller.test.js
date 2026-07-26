import { describe, expect, it, vi } from 'vitest';

import { createAuthController } from '../../../src/modules/auth/auth.controller.js';

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
const result = {
  organization,
  user,
  tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
};

const createResponse = () => {
  const response = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  response.send = vi.fn(() => response);
  response.setHeader = vi.fn(() => response);
  return response;
};

const createDependencies = () => ({
  registerOrganizationAdmin: vi.fn().mockResolvedValue(result),
  loginUser: vi.fn().mockResolvedValue(result),
  refreshAuthentication: vi.fn().mockResolvedValue(result),
  getRefreshTokenCookie: vi.fn().mockReturnValue('refresh-token'),
  clearRefreshTokenCookie: vi.fn(),
  setRefreshTokenCookie: vi.fn(),
});

describe('authentication controllers', () => {
  it('returns frozen register and login handlers', () => {
    const controller = createAuthController(createDependencies());

    expect(Object.isFrozen(controller)).toBe(true);
    expect(controller.register).toBeTypeOf('function');
    expect(controller.login).toBeTypeOf('function');
  });

  it('registers from request.validated.body, sets the cookie, and returns safe data', async () => {
    const dependencies = createDependencies();
    const controller = createAuthController(dependencies);
    const body = { email: 'validated@example.com', password: 'StrongPass1' };
    const request = { validated: { body }, body: { email: 'untrusted@example.com' } };
    const response = createResponse();

    await controller.register(request, response);

    expect(dependencies.registerOrganizationAdmin).toHaveBeenCalledWith(body);
    expect(dependencies.setRefreshTokenCookie).toHaveBeenCalledWith(response, 'refresh-token');
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: {
        organization,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        accessToken: 'access-token',
      },
    });
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('data.tokens');
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('data.passwordHash');
    expect(response.json.mock.calls[0][0].data.user).not.toHaveProperty('tenantId');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('login uses validated input, sets the cookie, and returns HTTP 200', async () => {
    const dependencies = createDependencies();
    const controller = createAuthController(dependencies);
    const body = { email: 'validated@example.com', password: 'StrongPass1' };
    const response = createResponse();

    await controller.login({ validated: { body } }, response);

    expect(dependencies.loginUser).toHaveBeenCalledWith(body);
    expect(dependencies.setRefreshTokenCookie).toHaveBeenCalledWith(response, 'refresh-token');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json.mock.calls[0][0].data.accessToken).toBe('access-token');
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('data.refreshToken');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('returns organization null for Super Admin login', async () => {
    const dependencies = createDependencies();
    dependencies.loginUser.mockResolvedValue({ ...result, organization: null });
    const response = createResponse();

    await createAuthController(dependencies).login({ validated: { body: {} } }, response);

    expect(response.json.mock.calls[0][0].data.organization).toBeNull();
  });

  it('refreshes from the cookie helper and rotates the cookie', async () => {
    const dependencies = createDependencies();
    const response = createResponse();

    await createAuthController(dependencies).refresh({ cookies: {} }, response);

    expect(dependencies.getRefreshTokenCookie).toHaveBeenCalledWith({ cookies: {} });
    expect(dependencies.refreshAuthentication).toHaveBeenCalledWith('refresh-token');
    expect(dependencies.setRefreshTokenCookie).toHaveBeenCalledWith(response, 'refresh-token');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json.mock.calls[0][0].data.accessToken).toBe('access-token');
    expect(response.json.mock.calls[0][0]).not.toHaveProperty('data.refreshToken');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('rejects a missing refresh cookie and clears logout idempotently with HTTP 204', async () => {
    const dependencies = createDependencies();
    dependencies.getRefreshTokenCookie.mockReturnValue(null);
    const response = createResponse();

    await expect(
      createAuthController(dependencies).refresh({ cookies: {} }, response),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    await createAuthController(dependencies).logout({}, response);

    expect(dependencies.clearRefreshTokenCookie).toHaveBeenCalledWith(response);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.json).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('allows service errors to propagate and never logs credentials', async () => {
    const failure = new Error('service failure');
    const dependencies = createDependencies();
    dependencies.loginUser.mockRejectedValue(failure);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      createAuthController(dependencies).login({ validated: { body: {} } }, createResponse()),
    ).rejects.toBe(failure);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
