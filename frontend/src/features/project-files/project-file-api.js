import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';
import { sanitizeDownloadFilename } from './file-format.js';

const safeMetadataFields = [
  'id',
  'projectId',
  'originalName',
  'mimeType',
  'sizeBytes',
  'description',
  'status',
  'createdAt',
  'updatedAt',
];

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

function normalizeFile(file) {
  if (!file || typeof file !== 'object' || typeof file.id !== 'string') {
    throw invalidResponse();
  }
  return Object.freeze(Object.fromEntries(
    safeMetadataFields
      .filter((field) => Object.prototype.hasOwnProperty.call(file, field))
      .map((field) => [field, file[field]]),
  ));
}

function readFile(response) {
  if (response?.success !== true) throw invalidResponse();
  return normalizeFile(response?.data?.file);
}

function filesPath(projectId, fileId) {
  const base = `/projects/${encodeURIComponent(projectId)}/files`;
  return fileId === undefined ? base : `${base}/${encodeURIComponent(fileId)}`;
}

export async function uploadProjectFile(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  if (!input?.file || typeof input.file !== 'object') {
    throw new TypeError('A file is required.');
  }
  const body = new FormData();
  body.append('file', input.file);
  if (typeof input.description === 'string' && input.description.trim()) {
    body.append('description', input.description.trim());
  }
  const requestOptions = { method: 'POST', body, accessToken };
  if (input.signal) requestOptions.signal = input.signal;
  return readFile(await apiRequest(filesPath(input.projectId), requestOptions));
}

export async function listProjectFiles(options = {}, accessToken) {
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
    `${filesPath(options.projectId)}?${parameters.toString()}`,
    requestOptions,
  );
  if (
    response?.success !== true
    || !Array.isArray(response?.data?.files)
    || !response?.data?.pagination
    || typeof response.data.pagination !== 'object'
  ) {
    throw invalidResponse();
  }
  return {
    files: response.data.files.map(normalizeFile),
    pagination: response.data.pagination,
  };
}

export async function getProjectFile(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.fileId, 'A Project File ID');
  const requestOptions = { accessToken };
  if (input.signal) requestOptions.signal = input.signal;
  return readFile(await apiRequest(filesPath(input.projectId, input.fileId), requestOptions));
}

export async function updateProjectFile(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.fileId, 'A Project File ID');
  const body = {};
  for (const field of ['description', 'status']) {
    if (
      Object.prototype.hasOwnProperty.call(input?.updates ?? {}, field)
      && input.updates[field] !== undefined
    ) {
      body[field] = input.updates[field];
    }
  }
  return readFile(await apiRequest(filesPath(input.projectId, input.fileId), {
    method: 'PATCH',
    body,
    accessToken,
  }));
}

export async function downloadProjectFile(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.fileId, 'A Project File ID');
  const requestOptions = { accessToken, responseType: 'blob' };
  if (input.signal) requestOptions.signal = input.signal;
  const response = await apiRequest(
    `${filesPath(input.projectId, input.fileId)}/download`,
    requestOptions,
  );
  if (!(response?.data instanceof Blob)) throw invalidResponse();
  const headerName = readContentDispositionFilename(response.headers?.get?.('Content-Disposition'));
  const filename = sanitizeDownloadFilename(headerName, input.fallbackName);
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
  return filename;
}

function readContentDispositionFilename(header) {
  if (typeof header !== 'string') return '';
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      return '';
    }
  }
  return header.match(/filename\s*=\s*"([^"]*)"/i)?.[1]
    ?? header.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim()
    ?? '';
}
