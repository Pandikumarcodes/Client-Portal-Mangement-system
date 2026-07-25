import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';

const supportedUpdateFields = ['title', 'description', 'dueDate', 'status'];

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} is required.`);
  }
}

function invalidResponse() {
  return new ApiClientError({
    status: 0,
    code: 'INVALID_RESPONSE',
    message: 'The server returned an invalid response.',
  });
}

function readMilestone(response) {
  const milestone = response?.data?.milestone;
  if (
    response?.success !== true
    || !milestone
    || typeof milestone !== 'object'
    || typeof milestone.id !== 'string'
  ) {
    throw invalidResponse();
  }
  return milestone;
}

function milestonePath(projectId, milestoneId) {
  const base = `/projects/${encodeURIComponent(projectId)}/milestones`;
  return milestoneId === undefined ? base : `${base}/${encodeURIComponent(milestoneId)}`;
}

export async function createMilestone(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  const body = { title: input?.title };
  if (typeof input?.description === 'string' && input.description.trim()) {
    body.description = input.description;
  }
  if (typeof input?.dueDate === 'string' && input.dueDate.trim()) {
    body.dueDate = input.dueDate;
  }
  const response = await apiRequest(milestonePath(input.projectId), {
    method: 'POST',
    body,
    accessToken,
  });
  return readMilestone(response);
}

export async function listMilestones(options = {}, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(options.projectId, 'A Project ID');
  const parameters = new URLSearchParams();
  parameters.set('page', String(options.page ?? 1));
  parameters.set('limit', String(options.limit ?? 20));
  if (typeof options.status === 'string' && options.status.trim()) {
    parameters.set('status', options.status);
  }
  const requestOptions = { accessToken };
  if (options.signal) requestOptions.signal = options.signal;
  const response = await apiRequest(
    `${milestonePath(options.projectId)}?${parameters.toString()}`,
    requestOptions,
  );
  if (
    response?.success !== true
    || !Array.isArray(response?.data?.milestones)
    || !response?.data?.pagination
    || typeof response.data.pagination !== 'object'
  ) {
    throw invalidResponse();
  }
  return {
    milestones: response.data.milestones,
    pagination: response.data.pagination,
  };
}

export async function getMilestone(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.milestoneId, 'A Milestone ID');
  const requestOptions = { accessToken };
  if (input.signal) requestOptions.signal = input.signal;
  const response = await apiRequest(
    milestonePath(input.projectId, input.milestoneId),
    requestOptions,
  );
  return readMilestone(response);
}

export async function updateMilestone(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.milestoneId, 'A Milestone ID');
  const body = {};
  for (const field of supportedUpdateFields) {
    if (Object.prototype.hasOwnProperty.call(input?.updates ?? {}, field)) {
      body[field] = input.updates[field];
    }
  }
  const response = await apiRequest(
    milestonePath(input.projectId, input.milestoneId),
    { method: 'PATCH', body, accessToken },
  );
  return readMilestone(response);
}
