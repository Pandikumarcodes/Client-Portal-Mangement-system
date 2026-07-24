import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const readRequestId = (request) => {
  try {
    return request.headers?.['x-request-id'];
  } catch {
    return undefined;
  }
};

export const requestIdMiddleware = (request, response, next) => {
  const incomingRequestId = readRequestId(request);
  const requestId =
    typeof incomingRequestId === 'string' && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  request.id = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
};
