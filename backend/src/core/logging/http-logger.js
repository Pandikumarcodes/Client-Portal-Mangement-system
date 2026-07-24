import pinoHttp from 'pino-http';

const getRequestPath = (request) => {
  const requestUrl = request.originalUrl ?? request.url ?? '/';

  try {
    return new URL(requestUrl, 'http://request.local').pathname;
  } catch {
    return String(requestUrl).split('?')[0];
  }
};

const createCompletionObject = (request, response, value) => ({
  requestId: request.id,
  method: request.method,
  path: getRequestPath(request),
  statusCode: response.statusCode,
  responseTime: value.responseTime,
});

export function createHttpLogger(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    !options.loggerInstance ||
    typeof options.loggerInstance.child !== 'function'
  ) {
    throw new TypeError('A Pino logger instance is required.');
  }

  return pinoHttp({
    logger: options.loggerInstance,
    genReqId: (request) => request.id,
    customAttributeKeys: {
      reqId: 'requestId',
    },
    quietReqLogger: true,
    quietResLogger: true,
    customLogLevel: (request, response, error) => {
      void request;

      if (error || response.statusCode >= 500) {
        return 'error';
      }

      if (response.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },
    customSuccessObject: createCompletionObject,
    customErrorObject: (request, response, error, value) => {
      void error;

      return createCompletionObject(request, response, value);
    },
    customSuccessMessage: () => 'http_request_completed',
    customErrorMessage: () => 'http_request_completed',
  });
}
