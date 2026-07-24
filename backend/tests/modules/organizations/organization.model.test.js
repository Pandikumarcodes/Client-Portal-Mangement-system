import { afterAll, describe, expect, it, vi } from 'vitest';

import mongoose from 'mongoose';

const connectSpy = vi.spyOn(mongoose, 'connect');
const disconnectSpy = vi.spyOn(mongoose, 'disconnect');
const organizationModel = await import('../../../src/modules/organizations/organization.model.js');
const { Organization } = organizationModel;

const validOrganization = Object.freeze({
  name: 'Purple Block',
  slug: 'purple-block',
});

const getValidationError = async (values) => {
  const document = new Organization(values);

  try {
    await document.validate();
  } catch (error) {
    return error;
  }

  throw new Error('Expected organization validation to fail.');
};

afterAll(() => {
  connectSpy.mockRestore();
  disconnectSpy.mockRestore();
});

describe('Organization model registration', () => {
  it('exports exactly one Mongoose Organization model', () => {
    expect(Object.keys(organizationModel)).toEqual(['Organization']);
    expect(Organization.prototype).toBeInstanceOf(mongoose.Model);
    expect(Organization.modelName).toBe('Organization');
  });

  it('uses the explicit organizations collection', () => {
    expect(Organization.collection.name).toBe('organizations');
    expect(Organization.schema.options.collection).toBe('organizations');
  });

  it('does not connect or disconnect when imported', () => {
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});

describe('Organization field validation', () => {
  it('accepts a valid organization without connecting to MongoDB', async () => {
    const organization = new Organization(validOrganization);

    await expect(organization.validate()).resolves.toBeUndefined();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('requires a name', async () => {
    const error = await getValidationError({
      slug: validOrganization.slug,
    });

    expect(error.errors.name.message).toBe('Organization name is required.');
  });

  it('trims surrounding name whitespace without changing capitalization', () => {
    const organization = new Organization({
      ...validOrganization,
      name: '  Purple BLOCK  ',
    });

    expect(organization.name).toBe('Purple BLOCK');
  });

  it.each([
    ['shorter than 2 characters', 'A', 'at least 2'],
    ['longer than 120 characters', 'A'.repeat(121), 'at most 120'],
  ])('rejects a name %s', async (_description, name, expectedMessage) => {
    const error = await getValidationError({
      ...validOrganization,
      name,
    });

    expect(error.errors.name.message).toContain(expectedMessage);
  });

  it('requires a slug', async () => {
    const error = await getValidationError({
      name: validOrganization.name,
    });

    expect(error.errors.slug.message).toBe('Organization slug is required.');
  });

  it('trims and normalizes a slug to lowercase', () => {
    const organization = new Organization({
      ...validOrganization,
      slug: '  Purple-Block  ',
    });

    expect(organization.slug).toBe('purple-block');
  });

  it.each(['purple-block', 'agency-2026', 'pandi-software', 'a1-b2-c3'])(
    'accepts valid slug format %s',
    async (slug) => {
      const organization = new Organization({
        ...validOrganization,
        slug,
      });

      await expect(organization.validate()).resolves.toBeUndefined();
    },
  );

  it.each([
    ['an underscore', 'purple_block'],
    ['a space', 'purple block'],
    ['a leading hyphen', '-purple'],
    ['a trailing hyphen', 'purple-'],
    ['consecutive hyphens', 'purple--block'],
    ['a slash', 'purple/block'],
  ])('rejects a slug containing %s', async (_description, slug) => {
    const error = await getValidationError({
      ...validOrganization,
      slug,
    });

    expect(error.errors.slug.message).toBe(
      'Organization slug must contain lowercase letters, numbers, and single hyphens.',
    );
  });

  it.each([
    ['shorter than 2 characters', 'a', 'at least 2'],
    ['longer than 80 characters', 'a'.repeat(81), 'at most 80'],
  ])('rejects a slug %s', async (_description, slug, expectedMessage) => {
    const error = await getValidationError({
      ...validOrganization,
      slug,
    });

    expect(error.errors.slug.message).toContain(expectedMessage);
  });

  it('defaults status to active and plan to free', () => {
    const organization = new Organization(validOrganization);

    expect(organization.status).toBe('active');
    expect(organization.plan).toBe('free');
  });

  it.each(['active', 'suspended'])('accepts organization status %s', async (status) => {
    const organization = new Organization({
      ...validOrganization,
      status,
    });

    await expect(organization.validate()).resolves.toBeUndefined();
  });

  it('rejects an unknown status with a safe message', async () => {
    const status = 'unknown-status-fixture';
    const error = await getValidationError({
      ...validOrganization,
      status,
    });

    expect(error.errors.status.message).toBe('Organization status is invalid.');
    expect(error.errors.status.message).not.toContain(status);
  });

  it.each(['free', 'pro'])('accepts organization plan %s', async (plan) => {
    const organization = new Organization({
      ...validOrganization,
      plan,
    });

    await expect(organization.validate()).resolves.toBeUndefined();
  });

  it('rejects an unknown plan with a safe message', async () => {
    const plan = 'unknown-plan-fixture';
    const error = await getValidationError({
      ...validOrganization,
      plan,
    });

    expect(error.errors.plan.message).toBe('Organization plan is invalid.');
    expect(error.errors.plan.message).not.toContain(plan);
  });
});

describe('Organization schema invariants', () => {
  it('enables timestamps and disables the version key', () => {
    expect(Organization.schema.options.timestamps).toBe(true);
    expect(Organization.schema.path('createdAt')).toBeDefined();
    expect(Organization.schema.path('updatedAt')).toBeDefined();
    expect(Organization.schema.options.versionKey).toBe(false);
    expect(Organization.schema.path('__v')).toBeUndefined();
  });

  it('configures strict mode to throw and rejects unknown fields', () => {
    expect(Organization.schema.options.strict).toBe('throw');
    expect(
      () =>
        new Organization({
          ...validOrganization,
          unknownField: 'unknown-field-fixture',
        }),
    ).toThrow(mongoose.Error.StrictModeError);
  });

  it('contains exactly the requested business fields and managed fields', () => {
    expect(Object.keys(Organization.schema.paths).sort()).toEqual([
      '_id',
      'createdAt',
      'name',
      'plan',
      'slug',
      'status',
      'updatedAt',
    ]);
  });

  it.each([
    'tenantId',
    'ownerId',
    'ownerUserId',
    'createdBy',
    'updatedBy',
    'password',
    'passwordHash',
    'credential',
  ])('does not define deferred field %s', (field) => {
    expect(Organization.schema.path(field)).toBeUndefined();
  });

  it('defines exactly one named unique slug index', () => {
    expect(Organization.schema.indexes()).toEqual([
      [
        {
          slug: 1,
        },
        {
          unique: true,
          name: 'uniq_organizations_slug',
        },
      ],
    ]);
  });

  it('does not expose submitted fixture values in validation messages', async () => {
    const sensitiveFixture = 'private-fixture-value/segment';
    const error = await getValidationError({
      ...validOrganization,
      slug: sensitiveFixture,
    });
    const messages = Object.values(error.errors).map((validationError) => validationError.message);

    expect(JSON.stringify(messages)).not.toContain(sensitiveFixture);
  });

  it('performs document validation without a database connection', async () => {
    await new Organization(validOrganization).validate();

    expect(mongoose.connection.readyState).toBe(0);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});
