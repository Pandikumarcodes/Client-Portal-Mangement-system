import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage();

export const requestContextMiddleware = (request, response, next) => {
  void response;

  if (typeof request.id !== 'string' || request.id.length === 0) {
    next(new TypeError('Request ID must be assigned before request context.'));
    return;
  }

  requestContext.run(
    Object.freeze({
      requestId: request.id,
    }),
    next,
  );
};

export const getRequestId = () => requestContext.getStore()?.requestId;
