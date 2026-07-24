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

const safeResponse = (result) => ({
  success: true,
  data: {
    organization: result.organization,
    user: result.user,
    accessToken: result.tokens.accessToken,
  },
});

export function createAuthController(dependencies) {
  const resolved = resolveDependencies(dependencies);

  const register = async (request, response) => {
    const result = await resolved.registerOrganizationAdmin(request.validated.body);

    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);

    return response.status(201).json(safeResponse(result));
  };

  const login = async (request, response) => {
    const result = await resolved.loginUser(request.validated.body);

    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);

    return response.status(200).json(safeResponse(result));
  };

  const refresh = async (request, response) => {
    const refreshToken = resolved.getRefreshTokenCookie(request);
    if (!refreshToken) {
      throw createAuthenticationRequiredError();
    }

    const result = await resolved.refreshAuthentication(refreshToken);
    resolved.setRefreshTokenCookie(response, result.tokens.refreshToken);

    return response.status(200).json(safeResponse(result));
  };

  const logout = (request, response) => {
    void request;
    resolved.clearRefreshTokenCookie(response);
    return response.status(204).send();
  };

  return Object.freeze({ register, login, refresh, logout });
}
