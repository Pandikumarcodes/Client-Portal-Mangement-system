import {
  createOrganizationAdminAccount,
  findOrganizationById,
  findUserByIdForAuthentication,
  findUserForAuthentication,
} from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from './token.js';
import { ApiError } from '../../core/errors/api-error.js';
import { ORGANIZATION_STATUS } from '../organizations/organization.constants.js';
import { USER_ROLE, USER_STATUS } from '../users/user.constants.js';

const INVALID_CREDENTIALS_ERROR = Object.freeze({
  statusCode: 401,
  code: 'INVALID_CREDENTIALS',
  message: 'The email or password is incorrect.',
});
const AUTHENTICATION_REQUIRED_ERROR = Object.freeze({
  statusCode: 401,
  code: 'AUTHENTICATION_REQUIRED',
  message: 'Authentication is required.',
});

const duplicateErrorFields = (error) =>
  new Set([...Object.keys(error?.keyPattern ?? {}), ...Object.keys(error?.keyValue ?? {})]);

const isDuplicateFieldError = (error, field) =>
  error?.code === 11000 && duplicateErrorFields(error).has(field);

const createConflictError = (code, message) => new ApiError({ statusCode: 409, code, message });

const createInvalidCredentialsError = () => new ApiError(INVALID_CREDENTIALS_ERROR);
const createAuthenticationRequiredError = () => new ApiError(AUTHENTICATION_REQUIRED_ERROR);

const toSafeOrganization = (organization) => ({
  id: String(organization._id),
  name: organization.name,
  slug: organization.slug,
  status: organization.status,
  plan: organization.plan,
});

const toSafeUser = (user) => {
  const safeUser = {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
  };

  if (user.tenantId !== undefined && user.tenantId !== null) {
    safeUser.tenantId = String(user.tenantId);
  }

  return safeUser;
};

const freezeResult = ({ organization, user, tokens }) =>
  Object.freeze({
    organization,
    user: Object.freeze(user),
    tokens: Object.freeze(tokens),
  });

const resolveDependencies = (dependencies = {}) => ({
  createOrganizationAdminAccount,
  findOrganizationById,
  findUserByIdForAuthentication,
  findUserForAuthentication,
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  ...dependencies,
});

const assertUserCanAuthenticate = (user) => {
  if (user.status === USER_STATUS.SUSPENDED) {
    throw new ApiError({
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
      message: 'This account is suspended.',
    });
  }

  if (user.status === USER_STATUS.INVITED) {
    throw new ApiError({
      statusCode: 403,
      code: 'ACCOUNT_NOT_ACTIVE',
      message: 'This account is not active.',
    });
  }
};

const loadUserOrganization = async (user, findOrganizationById) => {
  if (user.role === USER_ROLE.SUPER_ADMIN) {
    return null;
  }

  if (user.tenantId === undefined || user.tenantId === null) {
    throw new Error('Tenant context is missing for user.');
  }

  const organization = await findOrganizationById(user.tenantId);
  if (!organization) {
    throw new Error('User organization could not be found.');
  }
  if (organization.status === ORGANIZATION_STATUS.SUSPENDED) {
    throw new ApiError({
      statusCode: 403,
      code: 'ORGANIZATION_SUSPENDED',
      message: 'This organization is suspended.',
    });
  }

  return organization;
};

const createAuthenticationResult = (user, organization, dependencies) => {
  const safeUser = toSafeUser(user);
  const identity = {
    userId: safeUser.id,
    role: safeUser.role,
    tenantId: safeUser.tenantId,
  };

  return freezeResult({
    organization: organization === null ? null : Object.freeze(toSafeOrganization(organization)),
    user: safeUser,
    tokens: {
      accessToken: dependencies.createAccessToken(identity),
      refreshToken: dependencies.createRefreshToken(identity),
    },
  });
};

export async function registerOrganizationAdmin(input, dependencies) {
  const { organizationName, organizationSlug, firstName, lastName, email, password } = input;
  const resolved = resolveDependencies(dependencies);
  const passwordHash = await resolved.hashPassword(password);

  let account;
  try {
    account = await resolved.createOrganizationAdminAccount({
      organization: { name: organizationName, slug: organizationSlug },
      user: { firstName, lastName, email, passwordHash },
    });
  } catch (error) {
    if (isDuplicateFieldError(error, 'email')) {
      throw createConflictError(
        'EMAIL_ALREADY_IN_USE',
        'An account with this email already exists.',
      );
    }
    if (isDuplicateFieldError(error, 'slug')) {
      throw createConflictError(
        'ORGANIZATION_SLUG_ALREADY_IN_USE',
        'This organization URL is already in use.',
      );
    }
    throw error;
  }

  const safeUser = toSafeUser(account.user);
  const identity = {
    userId: safeUser.id,
    role: safeUser.role,
    tenantId: safeUser.tenantId,
  };

  return freezeResult({
    organization: Object.freeze(toSafeOrganization(account.organization)),
    user: safeUser,
    tokens: {
      accessToken: resolved.createAccessToken(identity),
      refreshToken: resolved.createRefreshToken(identity),
    },
  });
}

export async function loginUser(input, dependencies) {
  const { email, password } = input;
  const resolved = resolveDependencies(dependencies);
  const user = await resolved.findUserForAuthentication(email);

  if (!user || !(await resolved.verifyPassword(password, user.passwordHash))) {
    throw createInvalidCredentialsError();
  }

  assertUserCanAuthenticate(user);
  const organization = await loadUserOrganization(user, resolved.findOrganizationById);

  return createAuthenticationResult(user, organization, resolved);
}

export async function refreshAuthentication(refreshToken, dependencies) {
  const resolved = resolveDependencies(dependencies);
  let verifiedToken;

  try {
    verifiedToken = await resolved.verifyRefreshToken(refreshToken);
  } catch {
    throw createAuthenticationRequiredError();
  }

  if (!verifiedToken) {
    throw createAuthenticationRequiredError();
  }

  const user = await resolved.findUserByIdForAuthentication(verifiedToken.userId);
  if (!user) {
    throw createAuthenticationRequiredError();
  }

  assertUserCanAuthenticate(user);
  const organization = await loadUserOrganization(user, resolved.findOrganizationById);

  return createAuthenticationResult(user, organization, resolved);
}
