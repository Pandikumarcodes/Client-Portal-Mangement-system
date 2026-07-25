import { Router } from 'express';
import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { requireRoles, requireTenantContext } from '../auth/auth.authorization.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createClientController } from './client.controller.js';
import {
  clientIdParamsSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from './client.schemas.js';

export function createClientRouter(dependencies) {
  const router = Router();
  const controller = createClientController(dependencies);
  const guards = [
    authenticateRequest,
    requireRoles(USER_ROLE.ORGANIZATION_ADMIN),
    requireTenantContext,
  ];
  router.post(
    '/',
    ...guards,
    validateRequest({ body: createClientSchema }),
    asyncHandler(controller.create),
  );
  router.get(
    '/',
    ...guards,
    validateRequest({ query: listClientsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:clientId',
    ...guards,
    validateRequest({ params: clientIdParamsSchema }),
    asyncHandler(controller.getById),
  );
  router.patch(
    '/:clientId',
    ...guards,
    validateRequest({ params: clientIdParamsSchema, body: updateClientSchema }),
    asyncHandler(controller.update),
  );
  return router;
}
export const clientRouter = createClientRouter();
export default clientRouter;
