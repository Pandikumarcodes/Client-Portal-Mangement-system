import { registerOrganizationAdmin, loginUser, refreshAuthentication } from './auth.service.js';
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from './auth.cookies.js';
import { ApiError } from '../../core/errors/api-error.js';

const resolveDependencies = (dependencies = {}) => ({
  registerOrganizationAdmin,
  loginUser,
  refreshAuthentication,
  getRefreshTokenCookie,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
  ...dependencies,
});

const createAuthenticationRequiredError = () =>
  new ApiError({
    statusCode: 401,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required.',
  });

const safeResponse = (result) => {
  const organization =
    result.organization === null
      ? null
      : {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
          status: result.organization.status,
          plan: result.organization.plan,
        };
  const user = {
    id: result.user.id,
    firstName: result.user.firstName,
    lastName: result.user.lastName,
    email: result.user.email,
    role: result.user.role,
    status: result.user.status,
  };

  return {
    success: true,
    data: {
      organization,
      user,
      accessToken: result.tokens.accessToken,
    },
  };
};
const preventAuthenticationCaching = (response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
};

export function createAuthController(dependencies) {
  const resolved = resolveDependencies(dependencies);

  const register = async (request, response) => {
    const result = await resolved.registerOrganizationAdmin(request.validated.body);

    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);
    preventAuthenticationCaching(response);

    return response.status(201).json(safeResponse(result));
  };

  const login = async (request, response) => {
    const result = await resolved.loginUser(request.validated.body);

    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);
    preventAuthenticationCaching(response);

    return response.status(200).json(safeResponse(result));
  };

  const refresh = async (request, response) => {
    const refreshToken = resolved.getRefreshTokenCookie(request);
    if (!refreshToken) {
      throw createAuthenticationRequiredError();
    }

    const result = await resolved.refreshAuthentication(refreshToken);
    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);
    preventAuthenticationCaching(response);

    return response.status(200).json(safeResponse(result));
  };

  const logout = (request, response) => {
    void request;
    resolved.clearRefreshTokenCookie(response);
    preventAuthenticationCaching(response);
    return response.status(204).send();
  };

  return Object.freeze({ register, login, refresh, logout });
}
