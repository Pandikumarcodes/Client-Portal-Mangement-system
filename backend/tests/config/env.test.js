import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

const originalProcessEnvironment = { ...process.env };
const safeMongoUri =
  'mongodb+srv://placeholder-user:placeholder-password@cluster.example.mongodb.net/client_management_portal';
const safeAccessSecret = 'access-secret-for-tests-with-at-least-32-chars';
const safeRefreshSecret = 'refresh-secret-for-tests-with-at-least-32-chars';

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

const importEnvironment = async () => {
  vi.resetModules();
  return import('../../src/config/env.js');
};

beforeEach(() => {
  process.env = {
    ...originalProcessEnvironment,
    MONGO_URI: safeMongoUri,
    CLIENT_URL: 'http://localhost:5173',
    JWT_ACCESS_SECRET: safeAccessSecret,
    JWT_REFRESH_SECRET: safeRefreshSecret,
  };
  delete process.env.NODE_ENV;
  delete process.env.PORT;
  delete process.env.DNS_SERVERS;
  delete process.env.LOG_LEVEL;
  delete process.env.PROJECT_FILE_STORAGE_ROOT;
});

afterEach(() => {
  process.env = { ...originalProcessEnvironment };
  vi.clearAllMocks();
});

describe('environment configuration', () => {
  it('defaults NODE_ENV to development', async () => {
    const { env } = await importEnvironment();

    expect(env.nodeEnv).toBe('development');
  });

  it('defaults PORT to 5000', async () => {
    const { env } = await importEnvironment();

    expect(env.port).toBe(5000);
  });

  it('accepts a valid NODE_ENV', async () => {
    process.env.NODE_ENV = 'development';

    const { env } = await importEnvironment();

    expect(env.nodeEnv).toBe('development');
  });

  it('converts a valid PORT string to a number', async () => {
    process.env.PORT = '8080';

    const { env } = await importEnvironment();

    expect(env.port).toBe(8080);
    expect(typeof env.port).toBe('number');
  });

  it('accepts and exports a valid MongoDB SRV URI', async () => {
    const { env } = await importEnvironment();

    expect(env.mongoUri).toBe(safeMongoUri);
  });

  it('accepts and exports a valid CLIENT_URL', async () => {
    const { env } = await importEnvironment();

    expect(env.clientUrl).toBe('http://localhost:5173');
  });

  it('accepts and exports separate JWT secrets', async () => {
    const { env } = await importEnvironment();

    expect(env.jwtAccessSecret).toBe(safeAccessSecret);
    expect(env.jwtRefreshSecret).toBe(safeRefreshSecret);
  });

  it('defaults and normalizes the Project File storage root', async () => {
    const { env } = await importEnvironment();

    expect(env.projectFileStorageRoot).toBe(path.resolve('./storage/project-files'));
  });

  it('normalizes a configured Project File storage root', async () => {
    process.env.PROJECT_FILE_STORAGE_ROOT = './temporary/project-files';

    const { env } = await importEnvironment();

    expect(env.projectFileStorageRoot).toBe(path.resolve('./temporary/project-files'));
  });

  it('rejects an empty, null-byte, or filesystem-root Project File storage root safely', async () => {
    for (const value of ['', 'private\0path', path.parse(path.resolve('.')).root]) {
      process.env.PROJECT_FILE_STORAGE_ROOT = value;
      await expect(importEnvironment()).rejects.toThrow(
        'Invalid environment configuration: invalid value for PROJECT_FILE_STORAGE_ROOT.',
      );
    }
  });

  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])('rejects a missing %s', async (field) => {
    delete process.env[field];

    await expect(importEnvironment()).rejects.toThrow(
      `Invalid environment configuration: invalid value for ${field}.`,
    );
  });

  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])('rejects a short %s', async (field) => {
    process.env[field] = 'too-short';

    await expect(importEnvironment()).rejects.toThrow(
      `Invalid environment configuration: invalid value for ${field}.`,
    );
  });

  it('rejects identical JWT secrets without exposing their value', async () => {
    const identicalSecret = 'identical-secret-for-tests-with-32-chars';
    process.env.JWT_ACCESS_SECRET = identicalSecret;
    process.env.JWT_REFRESH_SECRET = identicalSecret;

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for JWT_ACCESS_SECRET.',
    );

    try {
      await importEnvironment();
    } catch (error) {
      expect(error.message).not.toContain(identicalSecret);
    }
  });

  it.each([
    ['development', 'debug'],
    ['test', 'silent'],
    ['production', 'info'],
  ])('defaults LOG_LEVEL to %s policy value %s', async (nodeEnv, logLevel) => {
    process.env.NODE_ENV = nodeEnv;

    const { env } = await importEnvironment();

    expect(env.logLevel).toBe(logLevel);
  });

  it('derives LOG_LEVEL when the supplied value is empty', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = '';

    const { env } = await importEnvironment();

    expect(env.logLevel).toBe('info');
  });

  it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])(
    'accepts the %s LOG_LEVEL',
    async (logLevel) => {
      process.env.LOG_LEVEL = logLevel;

      const { env } = await importEnvironment();

      expect(env.logLevel).toBe(logLevel);
    },
  );

  it('rejects an unsupported LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'verbose';

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for LOG_LEVEL.',
    );
  });

  it('does not expose MongoDB credentials in LOG_LEVEL validation errors', async () => {
    const sensitiveMongoUri =
      'mongodb+srv://sensitive-user:sensitive-password@cluster.example.mongodb.net/database';
    process.env.MONGO_URI = sensitiveMongoUri;
    process.env.LOG_LEVEL = 'everything';

    let thrownError;

    try {
      await importEnvironment();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe(
      'Invalid environment configuration: invalid value for LOG_LEVEL.',
    );
    expect(thrownError.message).not.toContain('sensitive-user');
    expect(thrownError.message).not.toContain('sensitive-password');
    expect(thrownError.message).not.toContain(sensitiveMongoUri);
  });

  it('normalizes a trailing slash in CLIENT_URL', async () => {
    process.env.CLIENT_URL = 'http://localhost:5173/';

    const { env } = await importEnvironment();

    expect(env.clientUrl).toBe('http://localhost:5173');
  });

  it('defaults a missing DNS_SERVERS value to an empty array', async () => {
    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual([]);
  });

  it('normalizes an empty DNS_SERVERS value to an empty array', async () => {
    process.env.DNS_SERVERS = '';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual([]);
  });

  it('accepts one IPv4 DNS server', async () => {
    process.env.DNS_SERVERS = '1.1.1.1';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual(['1.1.1.1']);
  });

  it('accepts multiple comma-separated IPv4 DNS servers', async () => {
    process.env.DNS_SERVERS = '1.1.1.1,8.8.8.8';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual(['1.1.1.1', '8.8.8.8']);
  });

  it('trims whitespace and removes empty DNS server entries', async () => {
    process.env.DNS_SERVERS = ' 1.1.1.1, , 8.8.8.8, ';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual(['1.1.1.1', '8.8.8.8']);
  });

  it('normalizes duplicate DNS server addresses into one entry', async () => {
    process.env.DNS_SERVERS = '1.1.1.1, 1.1.1.1,8.8.8.8,8.8.8.8';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual(['1.1.1.1', '8.8.8.8']);
  });

  it('accepts an IPv6 DNS server', async () => {
    process.env.DNS_SERVERS = '2606:4700:4700::1111';

    const { env } = await importEnvironment();

    expect(env.dnsServers).toEqual(['2606:4700:4700::1111']);
  });

  it.each(['production', 'test'])('accepts the %s environment', async (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;

    const { env } = await importEnvironment();

    expect(env.nodeEnv).toBe(nodeEnv);
  });

  it('throws for an invalid NODE_ENV', async () => {
    process.env.NODE_ENV = 'staging';

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for NODE_ENV.',
    );
  });

  it('throws when MONGO_URI is missing', async () => {
    delete process.env.MONGO_URI;

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for MONGO_URI.',
    );
  });

  it('throws when MONGO_URI is empty', async () => {
    process.env.MONGO_URI = '';

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for MONGO_URI.',
    );
  });

  it('rejects a non-SRV MongoDB URI', async () => {
    process.env.MONGO_URI =
      'mongodb://placeholder-user:placeholder-password@cluster.example.mongodb.net/database';

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for MONGO_URI.',
    );
  });

  it('rejects an invalid MongoDB URI', async () => {
    process.env.MONGO_URI =
      'mongodb+srv://placeholder-user:placeholder-password@invalid hostname/database';

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for MONGO_URI.',
    );
  });

  it.each([
    ['a missing value', undefined],
    ['an empty value', ''],
    ['a relative URL', '/dashboard'],
    ['an FTP URL', 'ftp://example.com'],
    ['an invalid URL', 'not a URL'],
  ])('rejects CLIENT_URL with %s', async (_description, clientUrl) => {
    if (clientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = clientUrl;
    }

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for CLIENT_URL.',
    );
  });

  it('does not include MongoDB credentials in CLIENT_URL validation errors', async () => {
    const sensitiveMongoUri =
      'mongodb+srv://sensitive-user:sensitive-password@cluster.example.mongodb.net/database';
    process.env.MONGO_URI = sensitiveMongoUri;
    process.env.CLIENT_URL = 'javascript:alert(document.cookie)';

    let thrownError;

    try {
      await importEnvironment();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe(
      'Invalid environment configuration: invalid value for CLIENT_URL.',
    );
    expect(thrownError.message).not.toContain('sensitive-user');
    expect(thrownError.message).not.toContain('sensitive-password');
    expect(thrownError.message).not.toContain(sensitiveMongoUri);
  });

  it('does not include MongoDB credentials in configuration errors', async () => {
    process.env.MONGO_URI =
      'mongodb://sensitive-username:sensitive-password@cluster.example.mongodb.net/database';

    let thrownError;

    try {
      await importEnvironment();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe(
      'Invalid environment configuration: invalid value for MONGO_URI.',
    );
    expect(thrownError.message).not.toContain('sensitive-username');
    expect(thrownError.message).not.toContain('sensitive-password');
    expect(thrownError.message).not.toContain(process.env.MONGO_URI);
  });

  it.each([
    ['a hostname', 'dns.google'],
    ['a malformed address', '1,1,1,1'],
    ['an address with a protocol', 'https://1.1.1.1'],
    ['an invalid IPv4 address', '999.1.1.1'],
  ])('rejects DNS_SERVERS containing %s', async (_description, dnsServers) => {
    process.env.DNS_SERVERS = dnsServers;

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for DNS_SERVERS.',
    );
  });

  it('does not include MongoDB credentials in DNS validation errors', async () => {
    const sensitiveMongoUri =
      'mongodb+srv://sensitive-user:sensitive-password@cluster.example.mongodb.net/database';
    process.env.MONGO_URI = sensitiveMongoUri;
    process.env.DNS_SERVERS = 'dns.google';

    let thrownError;

    try {
      await importEnvironment();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe(
      'Invalid environment configuration: invalid value for DNS_SERVERS.',
    );
    expect(thrownError.message).not.toContain('sensitive-user');
    expect(thrownError.message).not.toContain('sensitive-password');
    expect(thrownError.message).not.toContain(sensitiveMongoUri);
  });

  it.each([
    ['zero', '0'],
    ['a negative value', '-1'],
    ['a non-numeric value', 'not-a-number'],
    ['a value above 65535', '65536'],
  ])('throws when PORT is %s', async (_description, port) => {
    process.env.PORT = port;

    await expect(importEnvironment()).rejects.toThrow(
      'Invalid environment configuration: invalid value for PORT.',
    );
  });

  it('exports a frozen configuration object', async () => {
    const environmentModule = await importEnvironment();

    expect(Object.keys(environmentModule)).toEqual(['env']);
    expect(Object.isFrozen(environmentModule.env)).toBe(true);
  });

  it('exports a frozen DNS server array', async () => {
    process.env.DNS_SERVERS = '1.1.1.1,8.8.8.8';

    const { env } = await importEnvironment();

    expect(Object.isFrozen(env.dnsServers)).toBe(true);
  });

  it('does not include unrelated environment values in validation errors', async () => {
    process.env.PORT = 'invalid';
    process.env.UNRELATED_SECRET = 'must-not-appear-in-an-error';

    let thrownError;

    try {
      await importEnvironment();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe('Invalid environment configuration: invalid value for PORT.');
    expect(thrownError.message).not.toContain(process.env.UNRELATED_SECRET);
  });
});
