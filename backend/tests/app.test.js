import { beforeEach, describe, expect, it, vi } from 'vitest';

import request from 'supertest';

const mocks = vi.hoisted(() => ({
  isDatabaseReady: vi.fn(),
  logChunks: [],
  env: Object.freeze({
    clientUrl: 'http://localhost:5173',
    nodeEnv: 'test',
    logLevel: 'silent',
    jwtAccessSecret: 'access-secret-for-app-tests-with-32-chars',
    jwtRefreshSecret: 'refresh-secret-for-app-tests-32-chars',
    projectFileStorageRoot: 'C:\\temporary\\project-file-app-tests',
  }),
}));

vi.mock('../src/config/env.js', () => ({
  env: mocks.env,
}));

vi.mock('../src/config/database.js', () => ({
  isDatabaseReady: mocks.isDatabaseReady,
}));

vi.mock('../src/core/logging/logger.js', async () => {
  const { Writable } = await vi.importActual('node:stream');
  const { default: pino } = await vi.importActual('pino');
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      mocks.logChunks.push(chunk.toString());
      callback();
    },
  });

  return {
    createLogger: vi.fn(),
    logger: pino(
      {
        level: 'trace',
        base: null,
      },
      destination,
    ),
  };
});

const { createApp } = await import('../src/app.js');

beforeEach(() => {
  mocks.logChunks.length = 0;
});

describe('createApp', () => {
  it('registers protected nested Project File routes without deletion or public storage', async () => {
    const listResponse = await request(createApp()).get(
      '/api/v1/projects/1234567890abcdef12345678/files',
    );
    const createResponse = await request(createApp()).post(
      '/api/v1/projects/1234567890abcdef12345678/files',
    );
    const downloadResponse = await request(createApp()).get(
      '/api/v1/projects/1234567890abcdef12345678/files/abcdefabcdef123456789012/download',
    );
    const deleteResponse = await request(createApp()).delete(
      '/api/v1/projects/1234567890abcdef12345678/files/abcdefabcdef123456789012',
    );
    const staticResponse = await request(createApp()).get('/storage/project-files/private.pdf');

    for (const response of [listResponse, createResponse, downloadResponse]) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(response.headers['x-request-id']).toEqual(expect.any(String));
    }
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(staticResponse.status).toBe(404);
    expect(staticResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('registers protected Project routes without implementing deletion', async () => {
    const listResponse = await request(createApp()).get('/api/v1/projects');
    const createResponse = await request(createApp()).post('/api/v1/projects').send({});
    const deleteResponse = await request(createApp()).delete(
      '/api/v1/projects/1234567890abcdef12345678',
    );

    expect(listResponse.status).toBe(401);
    expect(listResponse.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(createResponse.status).toBe(401);
    expect(createResponse.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('keeps the existing Client routes registered', async () => {
    const response = await request(createApp()).get('/api/v1/clients');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('registers authentication and lifecycle endpoints without adding unsupported routes', async () => {
    const registerResponse = await request(createApp())
      .post('/api/v1/auth/register')
      .send({ email: 'invalid' });
    const loginResponse = await request(createApp()).get('/api/v1/auth/login');
    const logoutResponse = await request(createApp()).post('/api/v1/auth/logout');
    const refreshResponse = await request(createApp()).post('/api/v1/auth/refresh');

    expect(registerResponse.status).toBe(400);
    expect(registerResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(loginResponse.status).toBe(404);
    expect(logoutResponse.status).toBe(204);
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns a new independent Express application without opening a listener', () => {
    const firstApp = createApp();
    const secondApp = createApp();

    expect(typeof firstApp).toBe('function');
    expect(typeof firstApp.listen).toBe('function');
    expect(firstApp).not.toBe(secondApp);
    expect(firstApp.listening).toBeUndefined();
    expect(secondApp.listening).toBeUndefined();
  });

  it('returns a healthy response when the database is ready', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const response = await request(createApp()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'client-management-portal-api',
        environment: 'test',
        status: 'healthy',
        database: 'connected',
      },
    });
    expect(new Date(response.body.data.timestamp).toISOString()).toBe(response.body.data.timestamp);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns an unavailable response when the database is not ready', async () => {
    mocks.isDatabaseReady.mockReturnValue(false);

    const response = await request(createApp()).get('/api/v1/health').expect(503);

    expect(response.body).toMatchObject({
      success: false,
      data: {
        status: 'unavailable',
        database: 'disconnected',
      },
    });
    expect(new Date(response.body.data.timestamp).toISOString()).toBe(response.body.data.timestamp);
  });

  it('returns a request ID for unavailable health and unknown-route responses', async () => {
    mocks.isDatabaseReady.mockReturnValue(false);

    const healthResponse = await request(createApp()).get('/api/v1/health').expect(503);
    const notFoundResponse = await request(createApp()).get('/missing').expect(404);

    expect(healthResponse.headers['x-request-id']).toEqual(expect.any(String));
    expect(notFoundResponse.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('preserves valid incoming request IDs and replaces invalid ones', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);
    const validRequestId = 'client.request-id_123';
    const validResponse = await request(createApp())
      .get('/api/v1/health')
      .set('X-Request-Id', validRequestId);
    const invalidResponse = await request(createApp())
      .get('/api/v1/health')
      .set('X-Request-Id', 'invalid/request/id');

    expect(validResponse.headers['x-request-id']).toBe(validRequestId);
    expect(invalidResponse.headers['x-request-id']).not.toBe('invalid/request/id');
    expect(invalidResponse.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates different IDs for different requests', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const firstResponse = await request(createApp()).get('/api/v1/health');
    const secondResponse = await request(createApp()).get('/api/v1/health');

    expect(firstResponse.headers['x-request-id']).not.toBe(secondResponse.headers['x-request-id']);
  });

  it('does not expose infrastructure secrets in health responses', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const response = await request(createApp()).get('/api/v1/health');
    const serializedResponse = JSON.stringify(response.body);

    expect(serializedResponse).not.toContain('MONGO_URI');
    expect(serializedResponse).not.toContain('username');
    expect(serializedResponse).not.toContain('password');
    expect(serializedResponse).not.toContain('DNS_SERVERS');
  });

  it('removes X-Powered-By and applies Helmet security headers', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const response = await request(createApp()).get('/api/v1/health');

    expect(response.headers).not.toHaveProperty('x-powered-by');
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('content-security-policy');
  });

  it('allows the configured credentialed CORS origin', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const response = await request(createApp())
      .get('/api/v1/health')
      .set('Origin', mocks.env.clientUrl);

    expect(response.headers['access-control-allow-origin']).toBe(mocks.env.clientUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not reflect an unrelated CORS origin', async () => {
    mocks.isDatabaseReady.mockReturnValue(true);

    const response = await request(createApp())
      .get('/api/v1/health')
      .set('Origin', 'https://unrelated.example');

    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('rejects JSON request bodies larger than 1mb', async () => {
    const oversizedBody = { value: 'a'.repeat(1024 * 1024) };

    const response = await request(createApp())
      .post('/api/v1/health')
      .send(oversizedBody)
      .expect('Content-Type', /application\/json/)
      .expect(413);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body exceeds the allowed size.',
      },
    });
  });

  it('returns the standardized safe JSON response for an unknown route', async () => {
    const requestedUrl = '/missing/private-resource?token=query-secret';

    const response = await request(createApp())
      .get(requestedUrl)
      .expect('Content-Type', /application\/json/)
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(requestedUrl);
    expect(JSON.stringify(response.body)).not.toContain('query-secret');
  });

  it('does not expose query tokens or cookies in application request logs', async () => {
    const queryToken = 'test-query-token-value';
    const cookieValue = 'session=test-cookie-value';

    await request(createApp())
      .get(`/missing?token=${queryToken}`)
      .set('Cookie', cookieValue)
      .expect(404);

    const serializedLogs = mocks.logChunks.join('');
    expect(serializedLogs).not.toContain(queryToken);
    expect(serializedLogs).not.toContain(cookieValue);
    expect(serializedLogs).not.toContain('test-cookie-value');
    expect(serializedLogs).toContain('"path":"/missing"');
  });

  it('returns INVALID_JSON for malformed JSON without a production test route', async () => {
    const response = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"invalidJson":')
      .expect('Content-Type', /application\/json/)
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'The request body contains invalid JSON.',
      },
    });
  });

  it.each(['/throw-error', '/test-error', '/debug', '/crash'])(
    'does not expose a production debug route at %s',
    async (path) => {
      const response = await request(createApp()).get(path).expect(404);

      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    },
  );
});
