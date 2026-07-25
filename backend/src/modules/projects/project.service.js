import { ApiError } from '../../core/errors/api-error.js';
import { findClientById } from '../clients/client.repository.js';
import {
  createProject,
  findProjectById,
  findProjects,
  updateProjectById,
} from './project.repository.js';

const projectNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'PROJECT_NOT_FOUND',
    message: 'The project was not found.',
  });
const clientNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'CLIENT_NOT_FOUND',
    message: 'The client was not found.',
  });
const requireTenantId = (tenantId) => {
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new TypeError('A trusted tenant context is required.');
  }
};
const toIsoString = (value) => (value instanceof Date ? value.toISOString() : value);
const toProjectDto = (project) =>
  Object.freeze({
    id: String(project._id),
    clientId: String(project.clientId),
    name: project.name,
    description: project.description ?? null,
    status: project.status,
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
  });
const resolveDependencies = (dependencies = {}) => ({
  createProject,
  findProjects,
  findProjectById,
  updateProjectById,
  findClientById,
  ...dependencies,
});

export async function createTenantProject(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  const client = await resolved.findClientById({
    tenantId: input.tenantId,
    clientId: input.clientId,
  });
  if (!client) throw clientNotFound();

  const project = await resolved.createProject({
    tenantId: input.tenantId,
    clientId: input.clientId,
    name: input.name,
    description: input.description,
  });
  return toProjectDto(project);
}

export async function listTenantProjects(input, dependencies) {
  requireTenantId(input.tenantId);
  const result = await resolveDependencies(dependencies).findProjects({
    tenantId: input.tenantId,
    page: input.page,
    limit: input.limit,
    status: input.status,
    clientId: input.clientId,
  });
  const pagination = Object.freeze({
    page: input.page,
    limit: input.limit,
    total: result.total,
    totalPages: result.total ? Math.ceil(result.total / input.limit) : 0,
  });
  return Object.freeze({
    projects: Object.freeze(result.projects.map(toProjectDto)),
    pagination,
  });
}

export async function getTenantProject(input, dependencies) {
  requireTenantId(input.tenantId);
  const project = await resolveDependencies(dependencies).findProjectById({
    tenantId: input.tenantId,
    projectId: input.projectId,
  });
  if (!project) throw projectNotFound();
  return toProjectDto(project);
}

export async function updateTenantProject(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  const updates = {};
  for (const field of ['clientId', 'name', 'description', 'status']) {
    if (Object.hasOwn(input.updates, field)) updates[field] = input.updates[field];
  }

  if (Object.hasOwn(updates, 'clientId')) {
    const client = await resolved.findClientById({
      tenantId: input.tenantId,
      clientId: updates.clientId,
    });
    if (!client) throw clientNotFound();
  }
  if (updates.description === null) updates.description = undefined;

  const project = await resolved.updateProjectById({
    tenantId: input.tenantId,
    projectId: input.projectId,
    updates,
  });
  if (!project) throw projectNotFound();
  return toProjectDto(project);
}
