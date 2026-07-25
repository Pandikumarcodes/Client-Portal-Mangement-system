import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';

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

function requireData(response, field) {
  if (
    response?.success !== true
    || response.data === null
    || typeof response.data !== 'object'
    || Array.isArray(response.data)
    || !Object.prototype.hasOwnProperty.call(response.data, field)
  ) {
    throw invalidResponse();
  }
  return response.data[field];
}

function requestOptions(accessToken, signal, method = 'GET', body) {
  const options = { accessToken, method };
  if (signal) options.signal = signal;
  if (body !== undefined) options.body = body;
  return options;
}

export async function getSuperAdminOverview(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const response = await apiRequest(
    '/super-admin/overview',
    requestOptions(accessToken, options.signal),
  );
  return requireData(response, 'overview');
}

export async function listOrganizations(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const parameters = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 20),
  });
  if (options.status) parameters.set('status', options.status);
  const response = await apiRequest(
    `/super-admin/organizations?${parameters.toString()}`,
    requestOptions(accessToken, options.signal),
  );
  const organizations = requireData(response, 'organizations');
  if (!Array.isArray(organizations) || !response.data.pagination) throw invalidResponse();
  return { organizations, pagination: response.data.pagination };
}

export async function getOrganization(organizationId, accessToken, signal) {
  requireAccessToken(accessToken);
  const response = await apiRequest(
    `/super-admin/organizations/${encodeURIComponent(organizationId)}`,
    requestOptions(accessToken, signal),
  );
  return requireData(response, 'organization');
}

export async function updateOrganizationStatus(
  organizationId,
  status,
  accessToken,
  signal,
) {
  requireAccessToken(accessToken);
  const response = await apiRequest(
    `/super-admin/organizations/${encodeURIComponent(organizationId)}/status`,
    requestOptions(accessToken, signal, 'PATCH', { status }),
  );
  return requireData(response, 'organization');
}

export async function listOrganizationUsers(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const parameters = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 20),
  });
  if (options.role) parameters.set('role', options.role);
  if (options.status) parameters.set('status', options.status);
  const response = await apiRequest(
    `/super-admin/organizations/${encodeURIComponent(options.organizationId)}/users?${parameters.toString()}`,
    requestOptions(accessToken, options.signal),
  );
  const users = requireData(response, 'users');
  if (!Array.isArray(users) || !response.data.pagination) throw invalidResponse();
  return { users, pagination: response.data.pagination };
}
