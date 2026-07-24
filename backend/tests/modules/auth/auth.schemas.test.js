import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from '../../../src/modules/auth/auth.schemas.js';

const validRegistration = {
  organizationName: '  Acme Studio  ',
  organizationSlug: '  Acme-Studio  ',
  firstName: '  Ada  ',
  lastName: '  Lovelace  ',
  email: '  ADA@Example.COM  ',
  password: 'StrongPass1',
};

describe('authentication schemas', () => {
  it('parses and normalizes valid registration input', () => {
    expect(registerSchema.parse(validRegistration)).toEqual({
      organizationName: 'Acme Studio',
      organizationSlug: 'acme-studio',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'StrongPass1',
    });
  });

  it('preserves password whitespace', () => {
    const result = registerSchema.parse({ ...validRegistration, password: ' StrongPass1 ' });

    expect(result.password).toBe(' StrongPass1 ');
  });

  it('rejects weak passwords', () => {
    for (const password of ['short', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumbersHere']) {
      expect(() => registerSchema.parse({ ...validRegistration, password })).toThrow();
    }
  });

  it('rejects invalid slugs and emails', () => {
    expect(() =>
      registerSchema.parse({ ...validRegistration, organizationSlug: 'bad slug' }),
    ).toThrow();
    expect(() => registerSchema.parse({ ...validRegistration, email: 'not-an-email' })).toThrow();
  });

  it('rejects unknown registration fields', () => {
    expect(() => registerSchema.parse({ ...validRegistration, extra: 'ignored' })).toThrow();
  });

  it('parses valid login input and normalizes email', () => {
    expect(loginSchema.parse({ email: ' ADA@Example.COM ', password: '  password  ' })).toEqual({
      email: 'ada@example.com',
      password: '  password  ',
    });
  });

  it('rejects empty login passwords and unknown fields', () => {
    expect(() => loginSchema.parse({ email: 'ada@example.com', password: '' })).toThrow();
    expect(() =>
      loginSchema.parse({ email: 'ada@example.com', password: 'Password1', extra: true }),
    ).toThrow();
  });

  it('does not expose submitted passwords in validation errors', () => {
    const submittedPassword = 'SensitiveSubmittedPassword1';
    let error;

    try {
      registerSchema.parse({ ...validRegistration, password: submittedPassword.slice(0, 4) });
    } catch (thrownError) {
      error = thrownError;
    }

    expect(error.message).not.toContain(submittedPassword);
  });
});
