import { isIP } from 'node:net';

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const isMongoSrvUri = (value) => {
  if (!value.startsWith('mongodb+srv://')) {
    return false;
  }

  try {
    const parsedUri = new URL(value);
    const hostnameLabels = parsedUri.hostname.split('.');
    const hasValidHostname = hostnameLabels.every((label) =>
      /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label),
    );

    return parsedUri.protocol === 'mongodb+srv:' && !parsedUri.port && hasValidHostname;
  } catch {
    return false;
  }
};

const dnsServersSchema = z
  .string()
  .optional()
  .transform((value) => [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean),
    ),
  ])
  .refine((servers) => servers.every((server) => isIP(server) !== 0));

const clientUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);

      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  })
  .transform((value) => value.replace(/\/$/, ''));

const logLevelSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional());

const jwtSecretSchema = z.string().min(32);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65_535).default(5000),
    MONGO_URI: z.string().trim().min(1).refine(isMongoSrvUri),
    DNS_SERVERS: dnsServersSchema,
    CLIENT_URL: clientUrlSchema,
    LOG_LEVEL: logLevelSchema,
    JWT_ACCESS_SECRET: jwtSecretSchema,
    JWT_REFRESH_SECRET: jwtSecretSchema,
  })
  .superRefine((values, context) => {
    if (values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT secrets must differ.',
      });
    }
  });

const validation = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  DNS_SERVERS: process.env.DNS_SERVERS,
  CLIENT_URL: process.env.CLIENT_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
});

if (!validation.success) {
  const invalidFields = [
    ...new Set(validation.error.issues.map((issue) => issue.path[0] ?? 'environment')),
  ];

  throw new Error(
    `Invalid environment configuration: invalid value for ${invalidFields.join(', ')}.`,
  );
}

const defaultLogLevels = Object.freeze({
  development: 'debug',
  test: 'silent',
  production: 'info',
});

export const env = Object.freeze({
  nodeEnv: validation.data.NODE_ENV,
  port: validation.data.PORT,
  mongoUri: validation.data.MONGO_URI,
  dnsServers: Object.freeze([...validation.data.DNS_SERVERS]),
  clientUrl: validation.data.CLIENT_URL,
  logLevel: validation.data.LOG_LEVEL ?? defaultLogLevels[validation.data.NODE_ENV],
  jwtAccessSecret: validation.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: validation.data.JWT_REFRESH_SECRET,
});
