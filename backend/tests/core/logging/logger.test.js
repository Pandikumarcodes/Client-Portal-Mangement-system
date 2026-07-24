import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/env.js', () => ({
  env: Object.freeze({
    logLevel: 'silent',
  }),
}));

vi.mock('../../../src/config/application.js', () => ({
  applicationName: 'client-management-portal-api',
  applicationEnvironment: 'test',
}));

const { createLogger, logger } = await import('../../../src/core/logging/logger.js');
const loggerSource = readFileSync(
  new URL('../../../src/core/logging/logger.js', import.meta.url),
  'utf8',
);

const createDestination = () => {
  const chunks = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  return {
    destination,
    entries: () =>
      chunks
        .join('')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    serialized: () => chunks.join(''),
  };
};

describe('createLogger', () => {
  it('returns a configured Pino logger and exports the production logger', () => {
    const memory = createDestination();
    const testLogger = createLogger({
      level: 'debug',
      destination: memory.destination,
    });

    expect(testLogger.level).toBe('debug');
    expect(testLogger.info).toBeTypeOf('function');
    expect(testLogger.child).toBeTypeOf('function');
    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf('function');
  });

  it('produces valid JSON with service, environment, and ISO timestamp', () => {
    const memory = createDestination();
    const testLogger = createLogger({
      level: 'info',
      destination: memory.destination,
    });

    testLogger.info({ event: 'test_event' }, 'Safe test event.');

    const [entry] = memory.entries();
    expect(entry).toMatchObject({
      service: 'client-management-portal-api',
      environment: 'test',
      event: 'test_event',
      msg: 'Safe test event.',
    });
    expect(new Date(entry.time).toISOString()).toBe(entry.time);
  });

  it('redacts supported sensitive fields without retaining original values', () => {
    const fixtureSecret = 'test-secret-value';
    const memory = createDestination();
    const testLogger = createLogger({
      level: 'info',
      destination: memory.destination,
    });

    testLogger.info({
      req: {
        headers: {
          authorization: fixtureSecret,
          cookie: fixtureSecret,
        },
      },
      res: {
        headers: {
          'set-cookie': fixtureSecret,
        },
      },
      password: fixtureSecret,
      passwordConfirmation: fixtureSecret,
      accessToken: fixtureSecret,
      refreshToken: fixtureSecret,
      token: fixtureSecret,
      secret: fixtureSecret,
      nested: {
        password: fixtureSecret,
        accessToken: fixtureSecret,
      },
    });

    const serialized = memory.serialized();
    const [entry] = memory.entries();
    expect(serialized).not.toContain(fixtureSecret);
    expect(serialized).toContain('[REDACTED]');
    expect(entry.req.headers.authorization).toBe('[REDACTED]');
    expect(entry.req.headers.cookie).toBe('[REDACTED]');
    expect(entry.res.headers['set-cookie']).toBe('[REDACTED]');
    expect(entry.password).toBe('[REDACTED]');
    expect(entry.passwordConfirmation).toBe('[REDACTED]');
    expect(entry.accessToken).toBe('[REDACTED]');
    expect(entry.refreshToken).toBe('[REDACTED]');
    expect(entry.secret).toBe('[REDACTED]');
  });

  it('does not serialize arbitrary error messages or stacks', () => {
    const internalDetail = 'test-private-error-detail';
    const memory = createDestination();
    const testLogger = createLogger({
      level: 'error',
      destination: memory.destination,
    });

    testLogger.error(
      {
        err: new Error(internalDetail),
      },
      'Safe error event.',
    );

    const serialized = memory.serialized();
    expect(serialized).not.toContain(internalDetail);
    expect(serialized).not.toContain('stack');
    expect(memory.entries()[0].err).toEqual({ name: 'Error' });
    expect(memory.entries()[0].msg).toBe('Safe error event.');
  });

  it('does not read process.env directly or terminate the process', () => {
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    const memory = createDestination();

    createLogger({
      level: 'silent',
      destination: memory.destination,
    });

    expect(loggerSource).not.toContain('process.env');
    expect(loggerSource).not.toContain('process.exit');
    expect(processExit).not.toHaveBeenCalled();
    processExit.mockRestore();
  });
});
