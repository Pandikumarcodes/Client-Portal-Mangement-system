import { ApiError } from '../../core/errors/api-error.js';
import { USER_ROLE } from '../users/user.constants.js';

const validRoles = new Set(Object.values(USER_ROLE));
const AUTHENTICATION_REQUIRED_ERROR = Object.freeze({
  statusCode: 401,
  code: 'AUTHENTICATION_REQUIRED',
  message: 'Authentication is required.',
});
const FORBIDDEN_ERROR = Object.freeze({
  statusCode: 403,
  code: 'FORBIDDEN',
  message: 'You do not have permission to perform this action.',
});

const createAuthenticationRequiredError = () => new ApiError(AUTHENTICATION_REQUIRED_ERROR);
const createForbiddenError = () => new ApiError(FORBIDDEN_ERROR);

export function requireRoles(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !validRoles.has(role))) {
    throw new TypeError('Role authorization requires existing user roles.');
  }

  return (request, response, next) => {
    void response;
    if (!request.auth) {
      next(createAuthenticationRequiredError());
      return;
    }
    if (!allowedRoles.includes(request.auth.role)) {
      next(createForbiddenError());
      return;
    }
    next();
  };
}

export function requireTenantContext(request, response, next) {
  void response;
  if (!request.auth) {
    next(createAuthenticationRequiredError());
    return;
  }

  if (
    request.auth.role === USER_ROLE.SUPER_ADMIN ||
    ![USER_ROLE.ORGANIZATION_ADMIN, USER_ROLE.CLIENT].includes(request.auth.role) ||
    typeof request.auth.tenantId !== 'string' ||
    request.auth.tenantId.length === 0
  ) {
    next(createForbiddenError());
    return;
  }

  next();
}
