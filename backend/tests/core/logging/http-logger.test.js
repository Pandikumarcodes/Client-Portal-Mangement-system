import { Writable } from 'node:stream';

import express from 'express';
import request from 'supertest';
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

import { createHttpLogger } from '../../../src/core/logging/http-logger.js';
import { createLogger } from '../../../src/core/logging/logger.js';

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

const createTestApplication = ({ statusCode = 200, throwError = false } = {}) => {
  const memory = createDestination();
  const loggerInstance = createLogger({
    level: 'trace',
    destination: memory.destination,
  });
  const httpLogger = createHttpLogger({ loggerInstance });
  const app = express();

  app.use((request_, _response, next) => {
    request_.id = 'pre-existing-request-id';
    next();
  });
  app.use(httpLogger);
  app.use(express.json());
  app.all('/resource', (request_, response, next) => {
    if (throwError) {
      next(new Error('Internal route failure.'));
      return;
    }

    response.setHeader('Set-Cookie', 'session=test-cookie-value');
    response.status(statusCode).json({
      requestId: request_.id,
      loggerRequestId: request_.log.bindings().requestId,
    });
  });
  app.use((error, request_, response, next) => {
    void error;
    void request_;
    void next;

    response.status(500).json({ success: false });
  });

  return { app, httpLogger, memory };
};

describe('createHttpLogger', () => {
  it('requires a logger and returns Express middleware', () => {
    expect(() => createHttpLogger()).toThrow(TypeError);

    const loggerInstance = createLogger({ level: 'silent' });
    expect(createHttpLogger({ loggerInstance })).toBeTypeOf('function');
  });

  it('emits one safe info-level completion event for a successful request', async () => {
    const { app, memory } = createTestApplication();

    const response = await request(app).get('/resource').expect(200);

    const entries = memory.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 30,
      requestId: 'pre-existing-request-id',
      method: 'GET',
      path: '/resource',
      statusCode: 200,
      msg: 'http_request_completed',
    });
    expect(entries[0].responseTime).toBeTypeOf('number');
    expect(response.body).toEqual({
      requestId: 'pre-existing-request-id',
      loggerRequestId: 'pre-existing-request-id',
    });
  });

  it('uses warn level for a 4xx response', async () => {
    const { app, memory } = createTestApplication({ statusCode: 404 });

    await request(app).get('/resource').expect(404);

    expect(memory.entries()).toHaveLength(1);
    expect(memory.entries()[0].level).toBe(40);
  });

  it('uses error level for a 5xx response', async () => {
    const { app, memory } = createTestApplication({ statusCode: 503 });

    await request(app).get('/resource').expect(503);

    expect(memory.entries()).toHaveLength(1);
    expect(memory.entries()[0].level).toBe(50);
  });

  it('uses error level for unexpected middleware errors', async () => {
    const { app, memory } = createTestApplication({ throwError: true });

    await request(app).get('/resource').expect(500);

    expect(memory.entries()).toHaveLength(1);
    expect(memory.entries()[0]).toMatchObject({
      level: 50,
      requestId: 'pre-existing-request-id',
      statusCode: 500,
    });
  });

  it('omits query values, headers, cookies, response cookies, and request bodies', async () => {
    const querySecret = 'test-query-secret';
    const authorization = 'Bearer test-authorization-value';
    const cookie = 'session=test-cookie-value';
    const password = 'test-password-value';
    const accessToken = 'test-access-token-value';
    const { app, memory } = createTestApplication();

    await request(app)
      .post(`/resource?token=${querySecret}&page=1`)
      .set('Authorization', authorization)
      .set('Cookie', cookie)
      .send({
        password,
        accessToken,
      })
      .expect(200);

    const serialized = memory.serialized();
    const [entry] = memory.entries();
    expect(entry.path).toBe('/resource');
    expect(serialized).not.toContain(querySecret);
    expect(serialized).not.toContain(authorization);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(accessToken);
    expect(serialized).not.toContain('set-cookie');
    expect(serialized).not.toContain('test-cookie-value');
    expect(entry).not.toHaveProperty('req');
    expect(entry).not.toHaveProperty('res');
    expect(entry).not.toHaveProperty('body');
    expect(entry).not.toHaveProperty('query');
  });
});
