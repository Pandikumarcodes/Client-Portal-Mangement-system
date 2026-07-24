import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { User } from '../../../src/modules/users/user.model.js';
import { hashPassword, verifyPassword } from '../../../src/modules/auth/password.js';

vi.setConfig({ testTimeout: 20_000 });

const passwordModuleSource = readFileSync(
  new URL('../../../src/modules/auth/password.js', import.meta.url),
  'utf8',
);
const userModelSource = readFileSync(
  new URL('../../../src/modules/users/user.model.js', import.meta.url),
  'utf8',
);
const plainPassword = 'safe-passphrase-123';

describe('password utilities', () => {
  it('exports exactly hashPassword and verifyPassword', async () => {
    const passwordModule = await import('../../../src/modules/auth/password.js');

    expect(Object.keys(passwordModule).sort()).toEqual(['hashPassword', 'verifyPassword']);
  });

  it('hashPassword returns a Promise resolving to a bcrypt hash', async () => {
    const result = hashPassword(plainPassword);

    expect(result).toBeInstanceOf(Promise);
    const passwordHash = await result;

    expect(passwordHash).toBeTypeOf('string');
    expect(passwordHash).not.toBe(plainPassword);
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('hashes the same password to different hashes because salts are generated', async () => {
    const firstHash = await hashPassword(plainPassword);
    const secondHash = await hashPassword(plainPassword);

    expect(firstHash).not.toBe(secondHash);
  }, 20000);

  it('verifies matching and non-matching passwords', async () => {
    const passwordHash = await hashPassword(plainPassword);

    await expect(verifyPassword(plainPassword, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword('different-passphrase', passwordHash)).resolves.toBe(false);
  });

  it('preserves password whitespace as significant input', async () => {
    const whitespacePassword = '  safe-passphrase-123  ';
    const passwordHash = await hashPassword(whitespacePassword);

    await expect(verifyPassword(whitespacePassword, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(whitespacePassword.trim(), passwordHash)).resolves.toBe(false);
  });

  it.each([undefined, null, 42, {}, []])(
    'rejects non-string hashPassword input %j',
    async (password) => {
      await expect(hashPassword(password)).rejects.toThrow(TypeError);
    },
  );

  it('rejects an empty password for both operations', async () => {
    const passwordHash = await hashPassword(plainPassword);

    await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string.');
    await expect(verifyPassword('', passwordHash)).rejects.toThrow(
      'Password must be a non-empty string.',
    );
  });

  it('rejects passwords longer than 128 characters', async () => {
    const longPassword = 'a'.repeat(129);

    await expect(hashPassword(longPassword)).rejects.toThrow(
      'Password must not exceed 128 characters.',
    );
    await expect(verifyPassword(longPassword, 'not-used')).rejects.toThrow(
      'Password must not exceed 128 characters.',
    );
  });

  it.each([undefined, null, 42, {}, []])(
    'rejects non-string passwordHash input %j',
    async (passwordHash) => {
      await expect(verifyPassword(plainPassword, passwordHash)).rejects.toThrow(TypeError);
    },
  );

  it('rejects an empty passwordHash', async () => {
    await expect(verifyPassword(plainPassword, '')).rejects.toThrow(
      'Password hash must be a non-empty string.',
    );
  });

  it('returns false for malformed or unsupported hashes', async () => {
    await expect(verifyPassword(plainPassword, 'not-a-bcrypt-hash')).resolves.toBe(false);
  });

  it('does not expose supplied password or hash values in errors', async () => {
    const suppliedPassword = 'a'.repeat(129);
    const suppliedHash = 42;

    let passwordError;
    let hashError;
    try {
      await hashPassword(suppliedPassword);
    } catch (error) {
      passwordError = error;
    }
    try {
      await verifyPassword(plainPassword, suppliedHash);
    } catch (error) {
      hashError = error;
    }

    expect(passwordError.message).not.toContain(suppliedPassword);
    expect(hashError.message).not.toContain(String(suppliedHash));
  });

  it('does not log, exit, read process.env, or connect to MongoDB', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);

    await hashPassword(plainPassword);

    expect(passwordModuleSource).not.toContain('process.env');
    expect(passwordModuleSource).not.toContain('process.exit');
    expect(passwordModuleSource).not.toContain('mongoose');
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(processExit).not.toHaveBeenCalled();

    consoleLog.mockRestore();
    consoleError.mockRestore();
    processExit.mockRestore();
  });

  it('keeps password hashing outside the User model', () => {
    expect(User.schema.path('password')).toBeUndefined();
    expect(userModelSource).not.toContain('.pre(');
    expect(userModelSource).not.toContain('.post(');
  });
});
