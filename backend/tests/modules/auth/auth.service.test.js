import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOrganizationAdminAccount: vi.fn(),
  findOrganizationById: vi.fn(),
  findUserByIdForAuthentication: vi.fn(),
  findUserForAuthentication: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createAccessToken: vi.fn(),
  createRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

vi.mock('../../../src/modules/auth/auth.repository.js', () => ({
  createOrganizationAdminAccount: mocks.createOrganizationAdminAccount,
  findOrganizationById: mocks.findOrganizationById,
  findUserByIdForAuthentication: mocks.findUserByIdForAuthentication,
  findUserForAuthentication: mocks.findUserForAuthentication,
}));
vi.mock('../../../src/modules/auth/password.js', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock('../../../src/modules/auth/token.js', () => ({
  createAccessToken: mocks.createAccessToken,
  createRefreshToken: mocks.createRefreshToken,
  verifyRefreshToken: mocks.verifyRefreshToken,
}));

import { loginUser, registerOrganizationAdmin } from '../../../src/modules/auth/auth.service.js';

const organization = {
  _id: 'organization-id',
  name: 'Acme Studio',
  slug: 'acme-studio',
  status: 'active',
  plan: 'free',
};
const tenantUser = {
  _id: 'user-id',
  tenantId: 'organization-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  passwordHash: 'stored-hash',
  role: 'organization_admin',
  status: 'active',
};
const superAdmin = {
  ...tenantUser,
  _id: 'super-admin-id',
  tenantId: undefined,
  role: 'super_admin',
};

const registrationInput = {
  organizationName: organization.name,
  organizationSlug: organization.slug,
  firstName: tenantUser.firstName,
  lastName: tenantUser.lastName,
  email: tenantUser.email,
  password: 'StrongPass1',
};
const expectedTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue('hashed-password');
  mocks.createOrganizationAdminAccount.mockResolvedValue({ organization, user: tenantUser });
  mocks.findUserByIdForAuthentication.mockResolvedValue(tenantUser);
  mocks.createAccessToken.mockReturnValue(expectedTokens.accessToken);
  mocks.createRefreshToken.mockReturnValue(expectedTokens.refreshToken);
  mocks.findUserForAuthentication.mockResolvedValue(tenantUser);
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.verifyRefreshToken.mockReturnValue({
    userId: tenantUser._id,
    role: 'super_admin',
    tenantId: 'stale-tenant',
    tokenType: 'refresh',
    jti: 'refresh-id',
  });
  mocks.findOrganizationById.mockResolvedValue(organization);
});

describe('authentication services', () => {
  it('hashes registration passwords and never persists the plain password', async () => {
    await registerOrganizationAdmin(registrationInput);

    expect(mocks.hashPassword).toHaveBeenCalledWith(registrationInput.password);
    expect(mocks.createOrganizationAdminAccount).toHaveBeenCalledWith({
      organization: { name: organization.name, slug: organization.slug },
      user: expect.objectContaining({ passwordHash: 'hashed-password' }),
    });
    expect(mocks.createOrganizationAdminAccount.mock.calls[0][0].user).not.toHaveProperty(
      'password',
    );
  });

  it('returns safe registration data, tokens, and frozen result objects', async () => {
    const result = await registerOrganizationAdmin(registrationInput);

    expect(result).toEqual({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        plan: organization.plan,
      },
      user: {
        id: tenantUser._id,
        firstName: tenantUser.firstName,
        lastName: tenantUser.lastName,
        email: tenantUser.email,
        role: tenantUser.role,
        status: tenantUser.status,
      },
      tokens: expectedTokens,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.organization)).toBe(true);
    expect(Object.isFrozen(result.user)).toBe(true);
    expect(Object.isFrozen(result.tokens)).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('tenantId');
    expect(mocks.createAccessToken).toHaveBeenCalledWith({
      userId: tenantUser._id,
      role: tenantUser.role,
      tenantId: tenantUser.tenantId,
    });
  });

  it.each([
    [
      { code: 11000, keyPattern: { email: 1 }, keyValue: { email: tenantUser.email } },
      'EMAIL_ALREADY_IN_USE',
      'An account with this email already exists.',
    ],
    [
      { code: 11000, keyPattern: { slug: 1 }, keyValue: { slug: organization.slug } },
      'ORGANIZATION_SLUG_ALREADY_IN_USE',
      'This organization URL is already in use.',
    ],
  ])('maps duplicate errors safely', async (error, code, message) => {
    mocks.createOrganizationAdminAccount.mockRejectedValue(error);

    await expect(registerOrganizationAdmin(registrationInput)).rejects.toMatchObject({
      statusCode: 409,
      code,
      message,
    });
    await expect(registerOrganizationAdmin(registrationInput)).rejects.not.toHaveProperty(
      'details.email',
    );
  });

  it('preserves unexpected registration errors', async () => {
    const failure = new Error('unexpected failure');
    mocks.createOrganizationAdminAccount.mockRejectedValue(failure);

    await expect(registerOrganizationAdmin(registrationInput)).rejects.toBe(failure);
  });

  it('logs neither credentials nor tokens', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await registerOrganizationAdmin(registrationInput);
    await loginUser({ email: tenantUser.email, password: registrationInput.password });

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('logs in a valid tenant user and loads the Organization', async () => {
    const result = await loginUser({ email: tenantUser.email, password: 'StrongPass1' });

    expect(mocks.findUserForAuthentication).toHaveBeenCalledWith(tenantUser.email);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('StrongPass1', tenantUser.passwordHash);
    expect(mocks.findOrganizationById).toHaveBeenCalledWith(tenantUser.tenantId);
    expect(result.organization.id).toBe(organization._id);
    expect(result.tokens).toEqual(expectedTokens);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it.each([
    [null, false],
    [tenantUser, false],
  ])(
    'uses generic invalid credentials for missing or incorrect passwords',
    async (user, passwordValid) => {
      mocks.findUserForAuthentication.mockResolvedValue(user);
      mocks.verifyPassword.mockResolvedValue(passwordValid);

      await expect(
        loginUser({ email: tenantUser.email, password: 'WrongPass1' }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password is incorrect.',
      });
    },
  );

  it('uses generic invalid credentials for malformed stored hashes', async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(
      loginUser({ email: tenantUser.email, password: 'StrongPass1' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it.each([
    ['suspended', 'ACCOUNT_SUSPENDED', 'This account is suspended.'],
    ['invited', 'ACCOUNT_NOT_ACTIVE', 'This account is not active.'],
  ])('rejects %s users safely', async (status, code, message) => {
    mocks.findUserForAuthentication.mockResolvedValue({ ...tenantUser, status });

    await expect(
      loginUser({ email: tenantUser.email, password: 'StrongPass1' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code,
      message,
    });
  });

  it('rejects suspended Organizations', async () => {
    mocks.findOrganizationById.mockResolvedValue({ ...organization, status: 'suspended' });

    await expect(
      loginUser({ email: tenantUser.email, password: 'StrongPass1' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ORGANIZATION_SUSPENDED',
      message: 'The organization is suspended.',
    });
  });

  it('does not query an Organization for Super Admin and returns organization null', async () => {
    mocks.findUserForAuthentication.mockResolvedValue(superAdmin);

    const result = await loginUser({ email: superAdmin.email, password: 'StrongPass1' });

    expect(mocks.findOrganizationById).not.toHaveBeenCalled();
    expect(result.organization).toBeNull();
    expect(result.user).not.toHaveProperty('tenantId');
  });

  it('rejects a tenant user with a missing Organization as an unexpected error', async () => {
    mocks.findOrganizationById.mockResolvedValue(null);

    await expect(loginUser({ email: tenantUser.email, password: 'StrongPass1' })).rejects.toThrow(
      'User organization could not be found.',
    );
  });

  it('refreshes using the current User as the source of truth', async () => {
    const result = await (
      await import('../../../src/modules/auth/auth.service.js')
    ).refreshAuthentication('refresh-token');

    expect(mocks.verifyRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(mocks.findUserByIdForAuthentication).toHaveBeenCalledWith(tenantUser._id);
    expect(mocks.findOrganizationById).toHaveBeenCalledWith(tenantUser.tenantId);
    expect(mocks.createAccessToken).toHaveBeenCalledWith({
      userId: tenantUser._id,
      role: tenantUser.role,
      tenantId: tenantUser.tenantId,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('maps invalid or missing refresh users to AUTHENTICATION_REQUIRED', async () => {
    const { refreshAuthentication } = await import('../../../src/modules/auth/auth.service.js');
    mocks.verifyRefreshToken.mockReturnValue(null);
    await expect(refreshAuthentication('bad-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });

    mocks.verifyRefreshToken.mockReturnValue({ userId: 'missing', tokenType: 'refresh' });
    mocks.findUserByIdForAuthentication.mockResolvedValue(null);
    await expect(refreshAuthentication('missing-user-token')).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('rejects suspended and invited users during refresh', async () => {
    const { refreshAuthentication } = await import('../../../src/modules/auth/auth.service.js');
    for (const status of ['suspended', 'invited']) {
      mocks.findUserByIdForAuthentication.mockResolvedValue({ ...tenantUser, status });
      await expect(refreshAuthentication('refresh-token')).rejects.toMatchObject({
        statusCode: 403,
      });
    }
  });

  it('does not query an Organization when refreshing Super Admin', async () => {
    const { refreshAuthentication } = await import('../../../src/modules/auth/auth.service.js');
    mocks.findUserByIdForAuthentication.mockResolvedValue({ ...superAdmin });

    const result = await refreshAuthentication('refresh-token');

    expect(mocks.findOrganizationById).not.toHaveBeenCalled();
    expect(result.organization).toBeNull();
  });
});
