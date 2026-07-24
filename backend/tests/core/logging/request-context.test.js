import { describe, expect, it, vi } from 'vitest';

import {
  getRequestId,
  requestContextMiddleware,
} from '../../../src/core/logging/request-context.js';

const runInContext = (requestId, operation) =>
  new Promise((resolve, reject) => {
    const request = {
      id: requestId,
      body: {
        privateValue: 'body-value',
      },
      headers: {
        authorization: 'header-value',
      },
    };
    const next = vi.fn(() => {
      Promise.resolve().then(operation).then(resolve, reject);
    });

    requestContextMiddleware(request, {}, next);
  });

describe('request context', () => {
  it('returns undefined outside a request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('exposes the request ID and calls next once inside the context', async () => {
    const request = { id: 'context-id' };
    const next = vi.fn(() => {
      expect(getRequestId()).toBe('context-id');
    });

    requestContextMiddleware(request, {}, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('preserves the request ID after an awaited promise', async () => {
    await runInContext('promise-id', async () => {
      await Promise.resolve();
      expect(getRequestId()).toBe('promise-id');
    });
  });

  it('preserves the request ID inside a timer callback', async () => {
    await runInContext(
      'timer-id',
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            expect(getRequestId()).toBe('timer-id');
            resolve();
          }, 0);
        }),
    );
  });

  it('isolates two concurrent request contexts', async () => {
    const first = runInContext('first-id', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getRequestId()).toBe('first-id');
    });
    const second = runInContext('second-id', async () => {
      await Promise.resolve();
      expect(getRequestId()).toBe('second-id');
    });

    await Promise.all([first, second]);
    expect(getRequestId()).toBeUndefined();
  });

  it('stores no request body or headers and performs no logging', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runInContext('safe-id', async () => {
      expect(getRequestId()).toBe('safe-id');
      expect(JSON.stringify(getRequestId())).not.toContain('body-value');
      expect(JSON.stringify(getRequestId())).not.toContain('header-value');
    });

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });
});
