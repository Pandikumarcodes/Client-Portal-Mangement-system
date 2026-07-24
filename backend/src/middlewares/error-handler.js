import { ApiError } from '../core/errors/api-error.js';
import { logger } from '../core/logging/logger.js';
import { getRequestId } from '../core/logging/request-context.js';

const SAFE_ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;

const getSafeErrorName = (error) =>
  typeof error?.name === 'string' && SAFE_ERROR_NAME_PATTERN.test(error.name)
    ? error.name
    : 'Error';

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error?.type === 'entity.too.large' || error?.status === 413 || error?.statusCode === 413) {
    return new ApiError({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request body exceeds the allowed size.',
      cause: error,
    });
  }

  if (
    error instanceof SyntaxError &&
    error?.type === 'entity.parse.failed' &&
    (error?.status === 400 || error?.statusCode === 400)
  ) {
    return new ApiError({
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'The request body contains invalid JSON.',
      cause: error,
    });
  }

  return new ApiError({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
    cause: error,
  });
};

export const errorHandler = (error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);

  if (normalizedError.statusCode >= 500) {
    const loggingTarget =
      request.log && typeof request.log.error === 'function' ? request.log : logger;

    try {
      loggingTarget.error(
        {
          event: 'unhandled_http_error',
          requestId: request.id ?? getRequestId(),
          statusCode: normalizedError.statusCode,
          errorCode: normalizedError.code,
          errorName: getSafeErrorName(error),
        },
        'Unhandled HTTP error.',
      );
    } catch {
      // Logging failures must not alter the safe HTTP response.
    }
  }

  const errorResponse = {
    code: normalizedError.code,
    message: normalizedError.message,
  };

  if (normalizedError.details !== undefined) {
    errorResponse.details = normalizedError.details;
  }

  return response.status(normalizedError.statusCode).json({
    success: false,
    error: errorResponse,
  });
};
