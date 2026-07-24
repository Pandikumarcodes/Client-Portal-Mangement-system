import { afterAll, describe, expect, it, vi } from 'vitest';

import mongoose from 'mongoose';

const connectSpy = vi.spyOn(mongoose, 'connect');
const disconnectSpy = vi.spyOn(mongoose, 'disconnect');
const userModel = await import('../../../src/modules/users/user.model.js');
const { User } = userModel;
const tenantId = new mongoose.Types.ObjectId();

const validOrganizationAdmin = Object.freeze({
  tenantId,
  firstName: 'Pandi',
  lastName: 'Kumar',
  email: 'pandi@example.com',
  passwordHash: 'safe-hash-fixture-123456',
  role: 'organization_admin',
});

const validClient = Object.freeze({
  tenantId,
  firstName: 'Client',
  lastName: 'User',
  email: 'client@example.com',
  passwordHash: 'safe-client-hash-fixture',
  role: 'client',
});

const validSuperAdmin = Object.freeze({
  firstName: 'Platform',
  lastName: 'Admin',
  email: 'admin@example.com',
  passwordHash: 'safe-admin-hash-fixture',
  role: 'super_admin',
});

const getValidationError = async (values) => {
  const document = new User(values);

  try {
    await document.validate();
  } catch (error) {
    return error;
  }

  throw new Error('Expected user validation to fail.');
};

afterAll(() => {
  connectSpy.mockRestore();
  disconnectSpy.mockRestore();
});

describe('User model registration', () => {
  it('exports exactly one Mongoose User model', () => {
    expect(Object.keys(userModel)).toEqual(['User']);
    expect(User.prototype).toBeInstanceOf(mongoose.Model);
    expect(User.modelName).toBe('User');
  });

  it('uses the explicit users collection', () => {
    expect(User.collection.name).toBe('users');
    expect(User.schema.options.collection).toBe('users');
  });

  it('does not connect or disconnect when imported', () => {
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});

describe('User tenant membership', () => {
  it.each([validOrganizationAdmin, validClient])(
    'accepts a tenant-owned user with tenantId',
    async (values) => {
      await expect(new User(values).validate()).resolves.toBeUndefined();
    },
  );

  it('accepts a platform Super Admin without tenantId', async () => {
    await expect(new User(validSuperAdmin).validate()).resolves.toBeUndefined();
  });

  it.each(['organization_admin', 'client'])('requires tenantId for %s users', async (role) => {
    const error = await getValidationError({
      ...validSuperAdmin,
      email: `${role}@example.com`,
      role,
    });

    expect(error.errors.tenantId.message).toBe('Tenant ID is required for organization users.');
  });

  it.each([tenantId, null])('rejects tenantId for Super Admin users', async (suppliedTenantId) => {
    const error = await getValidationError({
      ...validSuperAdmin,
      tenantId: suppliedTenantId,
    });

    expect(error.errors.tenantId.message).toBe('Super Admin users cannot have a tenant ID.');
  });

  it('references Organization without importing or querying its model', () => {
    expect(User.schema.path('tenantId').options.ref).toBe('Organization');
    expect(User.schema.path('tenantId').instance).toBe('ObjectId');
  });
});

describe('User field validation', () => {
  it('requires firstName and trims it without changing capitalization', async () => {
    const user = new User({
      ...validOrganizationAdmin,
      firstName: '  Pandi  ',
    });

    expect(user.firstName).toBe('Pandi');
    await expect(
      new User({ ...validOrganizationAdmin, firstName: undefined }).validate(),
    ).rejects.toMatchObject({
      errors: {
        firstName: { message: 'First name is required.' },
      },
    });
  });

  it('rejects a firstName longer than 80 characters', async () => {
    const error = await getValidationError({
      ...validOrganizationAdmin,
      firstName: 'a'.repeat(81),
    });

    expect(error.errors.firstName.message).toContain('at most 80');
  });

  it('requires lastName and trims it without changing capitalization', async () => {
    const user = new User({
      ...validOrganizationAdmin,
      lastName: '  Kumar  ',
    });

    expect(user.lastName).toBe('Kumar');
    await expect(
      new User({ ...validOrganizationAdmin, lastName: undefined }).validate(),
    ).rejects.toMatchObject({
      errors: {
        lastName: { message: 'Last name is required.' },
      },
    });
  });

  it('rejects a lastName longer than 80 characters', async () => {
    const error = await getValidationError({
      ...validOrganizationAdmin,
      lastName: 'a'.repeat(81),
    });

    expect(error.errors.lastName.message).toContain('at most 80');
  });

  it('requires, trims, and lowercases email', async () => {
    const user = new User({
      ...validOrganizationAdmin,
      email: '  PANDI@EXAMPLE.COM  ',
    });

    expect(user.email).toBe('pandi@example.com');
    await expect(
      new User({ ...validOrganizationAdmin, email: undefined }).validate(),
    ).rejects.toMatchObject({
      errors: {
        email: { message: 'Email is required.' },
      },
    });
  });

  it('accepts a reasonable valid email format', async () => {
    await expect(
      new User({ ...validOrganizationAdmin, email: 'person+tag@example.co.uk' }).validate(),
    ).resolves.toBeUndefined();
  });

  it.each(['missing-domain', 'user@', '@example.com', 'user name@example.com'])(
    'rejects an invalid email %s',
    async (email) => {
      const error = await getValidationError({
        ...validOrganizationAdmin,
        email,
      });

      expect(error.errors.email.message).toBe('Email format is invalid.');
    },
  );

  it('rejects an email longer than 254 characters', async () => {
    const error = await getValidationError({
      ...validOrganizationAdmin,
      email: `${'a'.repeat(250)}@x.com`,
    });

    expect(error.errors.email.message).toContain('at most 254');
  });

  it('requires a passwordHash and enforces its length limits', async () => {
    await expect(
      new User({ ...validOrganizationAdmin, passwordHash: undefined }).validate(),
    ).rejects.toMatchObject({
      errors: {
        passwordHash: { message: 'Password hash is required.' },
      },
    });

    const shortError = await getValidationError({
      ...validOrganizationAdmin,
      passwordHash: 'short',
    });
    const longError = await getValidationError({
      ...validOrganizationAdmin,
      passwordHash: 'a'.repeat(256),
    });

    expect(shortError.errors.passwordHash.message).toContain('at least 20');
    expect(longError.errors.passwordHash.message).toContain('at most 255');
  });

  it('selects passwordHash out of query results by default', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false);
  });

  it('defines no password or token fields', () => {
    for (const field of [
      'password',
      'passwordConfirmation',
      'refreshToken',
      'resetToken',
      'accessToken',
    ]) {
      expect(User.schema.path(field)).toBeUndefined();
    }
  });
});

describe('User role and status validation', () => {
  it('requires role and does not provide a default role', async () => {
    expect(User.schema.path('role').defaultValue).toBeUndefined();

    const error = await getValidationError({
      ...validSuperAdmin,
      role: undefined,
    });

    expect(error.errors.role.message).toBe('User role is required.');
  });

  it.each(['super_admin', 'organization_admin', 'client'])('accepts role %s', async (role) => {
    const values = role === 'super_admin' ? validSuperAdmin : validOrganizationAdmin;

    await expect(new User({ ...values, role }).validate()).resolves.toBeUndefined();
  });

  it('rejects an unknown role', async () => {
    const error = await getValidationError({
      ...validSuperAdmin,
      role: 'unknown-role-fixture',
    });

    expect(error.errors.role.message).toBe('User role is invalid.');
  });

  it('defaults status to active', () => {
    expect(new User(validSuperAdmin).status).toBe('active');
  });

  it.each(['active', 'invited', 'suspended'])('accepts status %s', async (status) => {
    await expect(new User({ ...validSuperAdmin, status }).validate()).resolves.toBeUndefined();
  });

  it('rejects an unknown status', async () => {
    const error = await getValidationError({
      ...validSuperAdmin,
      status: 'unknown-status-fixture',
    });

    expect(error.errors.status.message).toBe('User status is invalid.');
  });
});

describe('User schema invariants', () => {
  it('enables timestamps, disables versioning, and throws on unknown fields', () => {
    expect(User.schema.options.timestamps).toBe(true);
    expect(User.schema.path('createdAt')).toBeDefined();
    expect(User.schema.path('updatedAt')).toBeDefined();
    expect(User.schema.options.versionKey).toBe(false);
    expect(User.schema.options.strict).toBe('throw');
    expect(() => new User({ ...validSuperAdmin, unknownField: 'unknown-field-fixture' })).toThrow(
      mongoose.Error.StrictModeError,
    );
  });

  it('contains only the requested business and managed fields', () => {
    expect(Object.keys(User.schema.paths).sort()).toEqual([
      '_id',
      'createdAt',
      'email',
      'firstName',
      'lastName',
      'passwordHash',
      'role',
      'status',
      'tenantId',
      'updatedAt',
    ]);
  });

  it('defines exactly the global email and tenant lookup indexes', () => {
    expect(User.schema.indexes()).toEqual([
      [{ email: 1 }, { unique: true, name: 'uniq_users_email' }],
      [{ tenantId: 1 }, { name: 'idx_users_tenant_id' }],
    ]);
  });

  it('does not expose sensitive fixture values in validation messages', async () => {
    const sensitiveFixture = 'private-email-fixture';
    const error = await getValidationError({
      ...validOrganizationAdmin,
      email: sensitiveFixture,
    });
    const messages = Object.values(error.errors).map((validationError) => validationError.message);

    expect(JSON.stringify(messages)).not.toContain(sensitiveFixture);
  });

  it('performs validation without a database connection', async () => {
    await new User(validOrganizationAdmin).validate();

    expect(mongoose.connection.readyState).toBe(0);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});
