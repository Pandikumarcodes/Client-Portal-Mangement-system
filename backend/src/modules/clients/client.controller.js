import {
  createTenantClient,
  getTenantClient,
  listTenantClients,
  updateTenantClient,
} from './client.service.js';

const resolve = (dependencies = {}) => ({
  createTenantClient,
  getTenantClient,
  listTenantClients,
  updateTenantClient,
  ...dependencies,
});
export function createClientController(dependencies) {
  const service = resolve(dependencies);
  const create = async (request, response) =>
    response.status(201).json({
      success: true,
      data: {
        client: await service.createTenantClient({
          ...request.validated.body,
          tenantId: request.auth.tenantId,
        }),
      },
    });
  const list = async (request, response) =>
    response.status(200).json({
      success: true,
      data: await service.listTenantClients({
        ...request.validated.query,
        tenantId: request.auth.tenantId,
      }),
    });
  const getById = async (request, response) =>
    response.status(200).json({
      success: true,
      data: {
        client: await service.getTenantClient({
          ...request.validated.params,
          tenantId: request.auth.tenantId,
        }),
      },
    });
  const update = async (request, response) =>
    response.status(200).json({
      success: true,
      data: {
        client: await service.updateTenantClient({
          clientId: request.validated.params.clientId,
          updates: request.validated.body,
          tenantId: request.auth.tenantId,
        }),
      },
    });
  return Object.freeze({ create, list, getById, update });
}
