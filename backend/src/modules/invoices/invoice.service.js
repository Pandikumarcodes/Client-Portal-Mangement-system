import { ApiError } from '../../core/errors/api-error.js';
import { findProjectById } from '../projects/project.repository.js';
import {
  createInvoice,
  findInvoiceById,
  findInvoices,
  updateInvoiceById,
} from './invoice.repository.js';

const projectNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'PROJECT_NOT_FOUND',
    message: 'The project was not found.',
  });
const invoiceNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'INVOICE_NOT_FOUND',
    message: 'The invoice was not found.',
  });
const invalidDateRange = () =>
  new ApiError({
    statusCode: 400,
    code: 'INVOICE_DATE_RANGE_INVALID',
    message: 'The due date must be on or after the issue date.',
  });
const requireTenantId = (tenantId) => {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new TypeError('A trusted tenant context is required.');
  }
};
const toIsoString = (value) => (value instanceof Date ? value : new Date(value)).toISOString();
const toInvoiceDto = (invoice) =>
  Object.freeze({
    id: String(invoice._id),
    projectId: String(invoice.projectId),
    invoiceNumber: invoice.invoiceNumber,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    issueDate: toIsoString(invoice.issueDate),
    dueDate: toIsoString(invoice.dueDate),
    status: invoice.status,
    notes: invoice.notes ?? null,
    createdAt: toIsoString(invoice.createdAt),
    updatedAt: toIsoString(invoice.updatedAt),
  });
const resolveDependencies = (dependencies = {}) => ({
  findProjectById,
  createInvoice,
  findInvoices,
  findInvoiceById,
  updateInvoiceById,
  ...dependencies,
});
const verifyProject = async (input, dependencies) => {
  const project = await dependencies.findProjectById({
    tenantId: input.tenantId,
    projectId: input.projectId,
  });
  if (!project) throw projectNotFound();
};
const verifyDateRange = (issueDate, dueDate) => {
  const issueTime = issueDate instanceof Date ? issueDate.getTime() : new Date(issueDate).getTime();
  const dueTime = dueDate instanceof Date ? dueDate.getTime() : new Date(dueDate).getTime();
  if (!Number.isFinite(issueTime) || !Number.isFinite(dueTime) || dueTime < issueTime) {
    throw invalidDateRange();
  }
};

export async function createProjectInvoice(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  verifyDateRange(input.issueDate, input.dueDate);
  const invoice = await resolved.createInvoice({
    tenantId: input.tenantId,
    projectId: input.projectId,
    invoiceNumber: input.invoiceNumber,
    amountCents: input.amountCents,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    notes: input.notes,
  });
  return toInvoiceDto(invoice);
}

export async function listProjectInvoices(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const result = await resolved.findInvoices({
    tenantId: input.tenantId,
    projectId: input.projectId,
    page: input.page,
    limit: input.limit,
    status: input.status,
  });
  return Object.freeze({
    invoices: Object.freeze(result.invoices.map(toInvoiceDto)),
    pagination: Object.freeze({
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: result.total ? Math.ceil(result.total / input.limit) : 0,
    }),
  });
}

export async function getProjectInvoice(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const invoice = await resolved.findInvoiceById({
    tenantId: input.tenantId,
    projectId: input.projectId,
    invoiceId: input.invoiceId,
  });
  if (!invoice) throw invoiceNotFound();
  return toInvoiceDto(invoice);
}

export async function updateProjectInvoice(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const existing = await resolved.findInvoiceById({
    tenantId: input.tenantId,
    projectId: input.projectId,
    invoiceId: input.invoiceId,
  });
  if (!existing) throw invoiceNotFound();

  const updates = {};
  for (const field of ['invoiceNumber', 'amountCents', 'issueDate', 'dueDate', 'status', 'notes']) {
    if (Object.hasOwn(input.updates, field)) updates[field] = input.updates[field];
  }
  const finalIssueDate = Object.hasOwn(updates, 'issueDate')
    ? updates.issueDate
    : existing.issueDate;
  const finalDueDate = Object.hasOwn(updates, 'dueDate') ? updates.dueDate : existing.dueDate;
  verifyDateRange(finalIssueDate, finalDueDate);
  if (updates.notes === null) updates.notes = undefined;

  const invoice = await resolved.updateInvoiceById({
    tenantId: input.tenantId,
    projectId: input.projectId,
    invoiceId: input.invoiceId,
    updates,
  });
  if (!invoice) throw invoiceNotFound();
  return toInvoiceDto(invoice);
}
