import { ApiError } from '../../core/errors/api-error.js';
import { asyncHandler } from '../../core/errors/async-handler.js';
import { ORGANIZATION_STATUS } from '../organizations/organization.constants.js';
import { USER_ROLE } from '../users/user.constants.js';
import { findOrganizationById } from './auth.repository.js';

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
const createOrganizationSuspendedError = () =>
  new ApiError({
    statusCode: 403,
    code: 'ORGANIZATION_SUSPENDED',
    message: 'The organization is suspended.',
  });

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

export function createRequireActiveTenantContext(dependencies = {}) {
  const loadOrganization = dependencies.findOrganizationById ?? findOrganizationById;

  if (typeof loadOrganization !== 'function') {
    throw new TypeError('Active tenant authorization requires an Organization lookup.');
  }

  return asyncHandler(async (request, response, next) => {
    requireTenantContext(request, response, (contextError) => {
      if (contextError) {
        throw contextError;
      }
    });

    const organization = await loadOrganization(request.auth.tenantId);
    if (!organization) {
      throw createAuthenticationRequiredError();
    }
    if (organization.status === ORGANIZATION_STATUS.SUSPENDED) {
      throw createOrganizationSuspendedError();
    }

    next();
  });
}
