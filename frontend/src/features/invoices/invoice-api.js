import { apiRequest } from '../../core/api/api-client.js';
import { ApiClientError } from '../../core/api/api-error.js';

const supportedUpdateFields = Object.freeze([
  'invoiceNumber',
  'amountCents',
  'issueDate',
  'dueDate',
  'status',
  'notes',
]);

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

function readInvoice(response) {
  const invoice = response?.data?.invoice;
  if (
    response?.success !== true
    || !invoice
    || typeof invoice !== 'object'
    || typeof invoice.id !== 'string'
  ) {
    throw invalidResponse();
  }
  return invoice;
}

function invoicePath(projectId, invoiceId) {
  const base = `/projects/${encodeURIComponent(projectId)}/invoices`;
  return invoiceId === undefined ? base : `${base}/${encodeURIComponent(invoiceId)}`;
}

export async function createInvoice(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  const body = {
    invoiceNumber: input?.invoiceNumber,
    amountCents: input?.amountCents,
    issueDate: input?.issueDate,
    dueDate: input?.dueDate,
  };
  if (typeof input?.notes === 'string' && input.notes.trim()) body.notes = input.notes;
  const response = await apiRequest(invoicePath(input.projectId), {
    method: 'POST',
    body,
    accessToken,
  });
  return readInvoice(response);
}

export async function listInvoices(options = {}, accessToken) {
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
    `${invoicePath(options.projectId)}?${parameters.toString()}`,
    requestOptions,
  );
  if (
    response?.success !== true
    || !Array.isArray(response?.data?.invoices)
    || !response?.data?.pagination
    || typeof response.data.pagination !== 'object'
  ) {
    throw invalidResponse();
  }
  return {
    invoices: response.data.invoices,
    pagination: response.data.pagination,
  };
}

export async function getInvoice(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.invoiceId, 'An Invoice ID');
  const requestOptions = { accessToken };
  if (input.signal) requestOptions.signal = input.signal;
  const response = await apiRequest(
    invoicePath(input.projectId, input.invoiceId),
    requestOptions,
  );
  return readInvoice(response);
}

export async function updateInvoice(input, accessToken) {
  requireText(accessToken, 'An access token');
  requireText(input?.projectId, 'A Project ID');
  requireText(input?.invoiceId, 'An Invoice ID');
  const body = {};
  for (const field of supportedUpdateFields) {
    if (
      Object.prototype.hasOwnProperty.call(input?.updates ?? {}, field)
      && input.updates[field] !== undefined
    ) {
      body[field] = input.updates[field];
    }
  }
  const response = await apiRequest(invoicePath(input.projectId, input.invoiceId), {
    method: 'PATCH',
    body,
    accessToken,
  });
  return readInvoice(response);
}
