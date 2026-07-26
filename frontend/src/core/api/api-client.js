import { frontendEnv } from '../../config/env.js';
import { ApiClientError } from './api-error.js';

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, accessToken, signal, responseType = 'json' } = options;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('API request paths must be relative to the configured API origin.');
  }
  const url = `${frontendEnv.apiBaseUrl}${path}`;
  const headers = {};
  const request = { method, credentials: 'include', headers, signal };
  if (body !== undefined) {
    if (body instanceof FormData) {
      request.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(body);
    }
  }
  if (typeof accessToken === 'string' && accessToken.length > 0) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(url, request);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiClientError({ status: 0, code: 'NETWORK_ERROR', message: 'Unable to connect to the server.', cause: error });
  }

  if (response.status === 204) return null;
  if (response.ok && responseType === 'blob') {
    return {
      data: await response.blob(),
      headers: response.headers,
    };
  }
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (response.ok) return payload;
  if (payload?.error?.code && typeof payload.error.message === 'string') {
    throw new ApiClientError({ status: response.status, code: payload.error.code, message: payload.error.message, details: payload.error.details });
  }
  throw new ApiClientError({ status: response.status, code: 'REQUEST_FAILED', message: 'The request could not be completed.' });
}
