import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  session: null,
  organization: null,
  user: null,
  findOneQuery: null,
  findById: vi.fn(),
  organizationCreate: vi.fn(),
  userCreate: vi.fn(),
}));

vi.mock('mongoose', () => ({
  default: {
    startSession: vi.fn(async () => state.session),
  },
}));

vi.mock('../../../src/modules/organizations/organization.model.js', () => ({
  Organization: {
    create: (...args) => state.organizationCreate(...args),
    findById: (...args) => state.findById(...args),
  },
}));

vi.mock('../../../src/modules/users/user.model.js', () => ({
  User: {
    create: (...args) => state.userCreate(...args),
    findOne: (...args) => {
      state.findOneQuery = { args };
      return {
        select: vi.fn((selection) => {
          state.findOneQuery.selection = selection;
          return Promise.resolve(state.user);
        }),
      };
    },
  },
}));

import {
  createOrganizationAdminAccount,
  findOrganizationById,
  findUserForAuthentication,
} from '../../../src/modules/auth/auth.repository.js';

const organization = {
  _id: 'organization-id',
  name: 'Acme Studio',
  slug: 'acme-studio',
  status: 'active',
  plan: 'free',
};
const user = {
  _id: 'user-id',
  tenantId: 'organization-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  passwordHash: 'hash-value-not-returned',
  role: 'organization_admin',
  status: 'active',
};

beforeEach(() => {
  state.organization = { ...organization };
  state.user = { ...user };
  state.findOneQuery = null;
  state.organizationCreate.mockReset().mockResolvedValue([state.organization]);
  state.userCreate.mockReset().mockResolvedValue([state.user]);
  state.findById.mockReset().mockResolvedValue(state.organization);
  state.session = {
    withTransaction: vi.fn(async (callback) => callback()),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
});

describe('authentication repository', () => {
  it('starts a session, creates Organization before User in a transaction, and ends the session', async () => {
    const result = await createOrganizationAdminAccount({
      organization: { name: organization.name, slug: organization.slug },
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        passwordHash: user.passwordHash,
      },
    });

    expect(state.session.withTransaction).toHaveBeenCalledOnce();
    expect(state.organizationCreate).toHaveBeenCalledBefore(state.userCreate);
    expect(state.userCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          tenantId: organization._id,
          role: 'organization_admin',
          status: 'active',
        }),
      ],
      { session: state.session },
    );
    expect(state.session.endSession).toHaveBeenCalledOnce();
    expect(result.organization).toBe(state.organization);
  });

  it('ends the session and rethrows transaction failures', async () => {
    const failure = new Error('transaction failed');
    state.session.withTransaction.mockRejectedValue(failure);

    await expect(createOrganizationAdminAccount({ organization: {}, user: {} })).rejects.toBe(
      failure,
    );
    expect(state.session.endSession).toHaveBeenCalledOnce();
  });

  it('does not expose passwordHash in the returned user', async () => {
    const result = await createOrganizationAdminAccount({ organization: {}, user: {} });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).toMatchObject({ _id: user._id, email: user.email, role: user.role });
  });

  it('explicitly selects passwordHash for authentication lookup', async () => {
    const result = await findUserForAuthentication('ada@example.com');

    expect(state.findOneQuery.args).toEqual([{ email: 'ada@example.com' }]);
    expect(state.findOneQuery.selection).toBe('+passwordHash');
    expect(result).toBe(state.user);
  });

  it('returns null when authentication user is missing', async () => {
    state.user = null;

    await expect(findUserForAuthentication('missing@example.com')).resolves.toBeNull();
  });

  it('finds an Organization by tenant ID or returns null', async () => {
    await expect(findOrganizationById('organization-id')).resolves.toBe(state.organization);
    state.findById.mockResolvedValue(null);
    await expect(findOrganizationById('missing-id')).resolves.toBeNull();
    expect(state.findById).toHaveBeenCalledWith('missing-id');
  });

  it('does not connect to a database directly', async () => {
    await createOrganizationAdminAccount({ organization: {}, user: {} });

    expect(state.session.withTransaction).toHaveBeenCalled();
  });
});
