import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';

const supportedUpdateFields = ['clientId', 'name', 'description', 'status'];

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

function readProject(response) {
  const project = response?.data?.project;
  if (
    response?.success !== true
    || !project
    || typeof project !== 'object'
    || typeof project.id !== 'string'
  ) {
    throw invalidResponse();
  }
  return project;
}

export async function createProject(input, accessToken) {
  requireAccessToken(accessToken);
  const body = {
    clientId: input?.clientId,
    name: input?.name,
  };
  if (typeof input?.description === 'string' && input.description.trim()) {
    body.description = input.description;
  }
  const response = await apiRequest('/projects', {
    method: 'POST',
    body,
    accessToken,
  });
  return readProject(response);
}

export async function listProjects(options = {}, accessToken) {
  requireAccessToken(accessToken);
  const parameters = new URLSearchParams();
  parameters.set('page', String(options.page ?? 1));
  parameters.set('limit', String(options.limit ?? 20));
  if (options.status) parameters.set('status', options.status);
  if (options.clientId) parameters.set('clientId', options.clientId);
  const requestOptions = { accessToken };
  if (options.signal) requestOptions.signal = options.signal;
  const response = await apiRequest(`/projects?${parameters.toString()}`, requestOptions);
  if (
    response?.success !== true
    || !Array.isArray(response?.data?.projects)
    || !response?.data?.pagination
  ) {
    throw invalidResponse();
  }
  return {
    projects: response.data.projects,
    pagination: response.data.pagination,
  };
}

export async function getProject(projectId, accessToken, signal) {
  requireAccessToken(accessToken);
  const requestOptions = { accessToken };
  if (signal) requestOptions.signal = signal;
  const response = await apiRequest(
    `/projects/${encodeURIComponent(projectId)}`,
    requestOptions,
  );
  return readProject(response);
}

export async function updateProject(projectId, updates, accessToken) {
  requireAccessToken(accessToken);
  const body = {};
  for (const field of supportedUpdateFields) {
    if (Object.prototype.hasOwnProperty.call(updates ?? {}, field)) {
      body[field] = updates[field];
    }
  }
  const response = await apiRequest(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body,
    accessToken,
  });
  return readProject(response);
}
