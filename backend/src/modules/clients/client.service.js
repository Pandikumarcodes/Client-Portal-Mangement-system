import { ApiError } from '../../core/errors/api-error.js';
import {
  createClient,
  findClientById,
  findClients,
  updateClientById,
} from './client.repository.js';

const duplicate = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.tenantId ||
    error?.keyPattern?.email ||
    error?.keyValue?.tenantId ||
    error?.keyValue?.email ||
    error?.index === 'uniq_clients_tenant_email');
const duplicateError = () =>
  new ApiError({
    statusCode: 409,
    code: 'CLIENT_EMAIL_ALREADY_IN_USE',
    message: 'A client with this email already exists.',
  });
const notFound = () =>
  new ApiError({ statusCode: 404, code: 'CLIENT_NOT_FOUND', message: 'The client was not found.' });
const dto = (client) =>
  Object.freeze({
    id: String(client._id),
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    companyName: client.companyName ?? null,
    status: client.status,
    createdAt: client.createdAt instanceof Date ? client.createdAt.toISOString() : client.createdAt,
    updatedAt: client.updatedAt instanceof Date ? client.updatedAt.toISOString() : client.updatedAt,
  });
const deps = (dependencies = {}) => ({
  createClient,
  findClients,
  findClientById,
  updateClientById,
  ...dependencies,
});

export async function createTenantClient(input, dependencies) {
  const resolved = deps(dependencies);
  try {
    return dto(await resolved.createClient(input));
  } catch (error) {
    if (duplicate(error)) throw duplicateError();
    throw error;
  }
}
export async function listTenantClients(input, dependencies) {
  const result = await deps(dependencies).findClients(input);
  const pagination = Object.freeze({
    page: input.page,
    limit: input.limit,
    total: result.total,
    totalPages: result.total ? Math.ceil(result.total / input.limit) : 0,
  });
  return Object.freeze({ clients: result.clients.map(dto), pagination });
}
export async function getTenantClient(input, dependencies) {
  const client = await deps(dependencies).findClientById(input);
  if (!client) throw notFound();
  return dto(client);
}
export async function updateTenantClient(input, dependencies) {
  const resolved = deps(dependencies);
  const updates = { ...input.updates };
  if (updates.companyName === null) updates.companyName = undefined;
  delete updates.tenantId;
  delete updates.userId;
  try {
    const client = await resolved.updateClientById({ ...input, updates });
    if (!client) throw notFound();
    return dto(client);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (duplicate(error)) throw duplicateError();
    throw error;
  }
}
