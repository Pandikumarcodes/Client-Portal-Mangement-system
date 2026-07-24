import { ApiError } from '../../core/errors/api-error.js';
import { verifyAccessToken } from './token.js';

const AUTHENTICATION_REQUIRED_ERROR = Object.freeze({
  statusCode: 401,
  code: 'AUTHENTICATION_REQUIRED',
  message: 'Authentication is required.',
});

const createAuthenticationRequiredError = () => new ApiError(AUTHENTICATION_REQUIRED_ERROR);

export function authenticateRequest(request, response, next) {
  void response;
  const authorization = request.headers?.authorization;
  const match = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(\S+)$/i) : null;

  if (!match) {
    next(createAuthenticationRequiredError());
    return;
  }

  let verifiedToken;
  try {
    verifiedToken = verifyAccessToken(match[1]);
  } catch {
    next(createAuthenticationRequiredError());
    return;
  }

  if (!verifiedToken || verifiedToken.tokenType !== 'access') {
    next(createAuthenticationRequiredError());
    return;
  }

  const auth = {
    userId: verifiedToken.userId,
    role: verifiedToken.role,
  };
  if (verifiedToken.tenantId !== undefined) {
    auth.tenantId = verifiedToken.tenantId;
  }

  request.auth = Object.freeze(auth);
  next();
}
