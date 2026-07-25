import { getOrganizationDashboard } from './dashboard.service.js';

export function createDashboardController(dependencies) {
  const service = { getOrganizationDashboard, ...dependencies };
  const getOrganization = async (request, response) => {
    const dashboard = await service.getOrganizationDashboard({
      tenantId: request.auth.tenantId,
    });

    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).json({
      success: true,
      data: {
        dashboard,
      },
    });
  };

  return Object.freeze({ getOrganization });
}
