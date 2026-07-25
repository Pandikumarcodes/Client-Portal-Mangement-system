import { apiRequest } from '../../core/api/api-client.js';

const supportedUpdateFields = ['firstName', 'lastName', 'email', 'companyName', 'status'];

function requireAccessToken(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new TypeError('An access token is required.');
  }
}

export async function createClient(input, accessToken) {
  requireAccessToken(accessToken);
  const body = {
    firstName: input?.firstName,
    lastName: input?.lastName,
    email: input?.email,
  };
  if (typeof input?.companyName === 'string' && input.companyName.trim()) {
    body.companyName = input.companyName;
  }
  const response = await apiRequest('/clients', {
    method: 'POST',
    body,
    accessToken,
  });
  return response.data.client;
}

export async function listClients(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const parameters = new URLSearchParams();
  parameters.set('page', String(options.page ?? 1));
  parameters.set('limit', String(options.limit ?? 20));
  if (options.status !== undefined && options.status !== '') {
    parameters.set('status', options.status);
  }
  const requestOptions = { accessToken };
  if (options.signal) requestOptions.signal = options.signal;
  const response = await apiRequest(`/clients?${parameters.toString()}`, requestOptions);
  return {
    clients: response.data.clients,
    pagination: response.data.pagination,
  };
}

export async function getClient(clientId, accessToken) {
  requireAccessToken(accessToken);
  const response = await apiRequest(`/clients/${encodeURIComponent(clientId)}`, {
    accessToken,
  });
  return response.data.client;
}

export async function updateClient(clientId, updates, accessToken) {
  requireAccessToken(accessToken);
  const body = {};
  for (const field of supportedUpdateFields) {
    if (Object.prototype.hasOwnProperty.call(updates ?? {}, field)) {
      body[field] = updates[field];
    }
  }
  const response = await apiRequest(`/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body,
    accessToken,
  });
  return response.data.client;
}
