import {
  createTenantProject,
  getTenantProject,
  listTenantProjects,
  updateTenantProject,
} from './project.service.js';

const resolveDependencies = (dependencies = {}) => ({
  createTenantProject,
  listTenantProjects,
  getTenantProject,
  updateTenantProject,
  ...dependencies,
});

export function createProjectController(dependencies) {
  const service = resolveDependencies(dependencies);
  const create = async (request, response) => {
    const body = request.validated.body;
    const project = await service.createTenantProject({
      tenantId: request.auth.tenantId,
      clientId: body.clientId,
      name: body.name,
      description: body.description,
    });
    return response.status(201).json({ success: true, data: { project } });
  };
  const list = async (request, response) => {
    const query = request.validated.query;
    const result = await service.listTenantProjects({
      tenantId: request.auth.tenantId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      clientId: query.clientId,
    });
    return response.status(200).json({
      success: true,
      data: {
        projects: result.projects,
        pagination: result.pagination,
      },
    });
  };
  const getById = async (request, response) => {
    const project = await service.getTenantProject({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
    });
    return response.status(200).json({ success: true, data: { project } });
  };
  const update = async (request, response) => {
    const project = await service.updateTenantProject({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      updates: request.validated.body,
    });
    return response.status(200).json({ success: true, data: { project } });
  };

  return Object.freeze({ create, list, getById, update });
}
