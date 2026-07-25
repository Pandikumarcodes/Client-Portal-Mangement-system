import {
  getOrganizationDetails,
  getSuperAdminOverview,
  listOrganizations,
  listOrganizationUsers,
  updateOrganizationStatus,
} from './super-admin.service.js';

export function createSuperAdminController(dependencies) {
  const service = {
    getOrganizationDetails,
    getSuperAdminOverview,
    listOrganizations,
    listOrganizationUsers,
    updateOrganizationStatus,
    ...dependencies,
  };

  const overview = async (_request, response) =>
    response.status(200).json({
      success: true,
      data: { overview: await service.getSuperAdminOverview({}) },
    });

  const list = async (request, response) =>
    response.status(200).json({
      success: true,
      data: await service.listOrganizations(request.validated.query),
    });

  const get = async (request, response) =>
    response.status(200).json({
      success: true,
      data: {
        organization: await service.getOrganizationDetails(request.validated.params),
      },
    });

  const updateStatus = async (request, response) =>
    response.status(200).json({
      success: true,
      data: {
        organization: await service.updateOrganizationStatus({
          organizationId: request.validated.params.organizationId,
          status: request.validated.body.status,
        }),
      },
    });

  const listUsers = async (request, response) =>
    response.status(200).json({
      success: true,
      data: await service.listOrganizationUsers({
        organizationId: request.validated.params.organizationId,
        ...request.validated.query,
      }),
    });

  return Object.freeze({
    overview,
    listOrganizations: list,
    getOrganization: get,
    updateOrganizationStatus: updateStatus,
    listOrganizationUsers: listUsers,
  });
}
