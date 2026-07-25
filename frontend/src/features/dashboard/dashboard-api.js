import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';
import { normalizeOrganizationDashboard } from './dashboard-normalization.js';

function requireAccessToken(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new TypeError('An access token is required.');
  }
}

function invalidResponse() {
  return new ApiClientError({
    status: 0,
    code: 'INVALID_RESPONSE',
    message: 'The server returned an invalid response.',
  });
}

export async function getOrganizationDashboard(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const requestOptions = { method: 'GET', accessToken };
  if (options.signal) requestOptions.signal = options.signal;

  const response = await apiRequest('/dashboard/organization', requestOptions);
  if (
    response?.success !== true
    || response.data === null
    || typeof response.data !== 'object'
    || Array.isArray(response.data)
    || !Object.prototype.hasOwnProperty.call(response.data, 'dashboard')
  ) {
    throw invalidResponse();
  }

  return normalizeOrganizationDashboard(response.data.dashboard);
}
