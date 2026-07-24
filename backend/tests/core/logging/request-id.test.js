import { describe, expect, it, vi } from 'vitest';

import { requestIdMiddleware } from '../../../src/core/logging/request-id.js';

const runMiddleware = (headerValue) => {
  const request = {
    headers: {},
  };

  if (headerValue !== undefined) {
    request.headers['x-request-id'] = headerValue;
  }

  const response = {
    setHeader: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };
  const next = vi.fn();

  requestIdMiddleware(request, response, next);

  return { request, response, next };
};

describe('requestIdMiddleware', () => {
  it('generates and returns a UUID when the header is missing', () => {
    const { request, response } = runMiddleware();

    expect(request.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', request.id);
  });

  it('preserves a valid client request ID', () => {
    const validRequestId = 'client.request_id-123';
    const { request, response } = runMiddleware(validRequestId);

    expect(request.id).toBe(validRequestId);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', validRequestId);
  });

  it.each([
    ['spaces', 'invalid request id'],
    ['slash', 'invalid/request-id'],
    ['backslash', 'invalid\\request-id'],
    ['quotes', '"invalid-request-id"'],
    ['comma', 'first-id,second-id'],
    ['empty value', ''],
    ['more than 100 characters', 'a'.repeat(101)],
    ['multiple values', ['first-id', 'second-id']],
  ])('replaces an incoming ID containing %s', (_description, headerValue) => {
    const { request } = runMiddleware(headerValue);

    expect(request.id).not.toEqual(headerValue);
    expect(request.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('does not throw when the request headers are malformed', () => {
    const request = {};
    Object.defineProperty(request, 'headers', {
      get() {
        throw new Error('Malformed client header state.');
      },
    });
    const response = {
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    expect(() => requestIdMiddleware(request, response, next)).not.toThrow();
    expect(request.id).toEqual(expect.any(String));
  });

  it('calls next once without sending a response, logging, or exiting', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined);
    const { response, next } = runMiddleware();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(response.json).not.toHaveBeenCalled();
    expect(response.send).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(processExit).not.toHaveBeenCalled();

    consoleLog.mockRestore();
    consoleError.mockRestore();
    processExit.mockRestore();
  });
});
