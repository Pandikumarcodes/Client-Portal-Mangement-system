import pino from 'pino';

import { applicationEnvironment, applicationName } from '../../config/application.js';
import { env } from '../../config/env.js';

const REDACTION_PATHS = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  "res.headers['set-cookie']",
  'password',
  'passwordConfirmation',
  'accessToken',
  'refreshToken',
  'token',
  'secret',
  '*.password',
  '*.passwordConfirmation',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
  '*.secret',
]);
const SAFE_ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;

const serializeErrorSafely = (error) => ({
  name:
    typeof error?.name === 'string' && SAFE_ERROR_NAME_PATTERN.test(error.name)
      ? error.name
      : 'Error',
});

export function createLogger(options = {}) {
  const { level = env.logLevel, destination } = options;
  const loggerOptions = {
    level,
    base: {
      service: applicationName,
      environment: applicationEnvironment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: serializeErrorSafely,
    },
    redact: {
      paths: [...REDACTION_PATHS],
      censor: '[REDACTED]',
    },
  };

  return destination === undefined ? pino(loggerOptions) : pino(loggerOptions, destination);
}

export const logger = createLogger();
