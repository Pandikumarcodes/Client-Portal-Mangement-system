import { Router } from 'express';

import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { requireRoles } from '../auth/auth.authorization.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createSuperAdminController } from './super-admin.controller.js';
import {
  listOrganizationsQuerySchema,
  listOrganizationUsersQuerySchema,
  organizationParamsSchema,
  updateOrganizationStatusSchema,
} from './super-admin.schemas.js';

export function createSuperAdminRouter(dependencies) {
  const router = Router();
  const controller = createSuperAdminController(dependencies);
  const guards = [authenticateRequest, requireRoles(USER_ROLE.SUPER_ADMIN)];

  router.get('/overview', ...guards, asyncHandler(controller.overview));
  router.get(
    '/organizations',
    ...guards,
    validateRequest({ query: listOrganizationsQuerySchema }),
    asyncHandler(controller.listOrganizations),
  );
  router.get(
    '/organizations/:organizationId/users',
    ...guards,
    validateRequest({
      params: organizationParamsSchema,
      query: listOrganizationUsersQuerySchema,
    }),
    asyncHandler(controller.listOrganizationUsers),
  );
  router.get(
    '/organizations/:organizationId',
    ...guards,
    validateRequest({ params: organizationParamsSchema }),
    asyncHandler(controller.getOrganization),
  );
  router.patch(
    '/organizations/:organizationId/status',
    ...guards,
    validateRequest({
      params: organizationParamsSchema,
      body: updateOrganizationStatusSchema,
    }),
    asyncHandler(controller.updateOrganizationStatus),
  );
  return router;
}

export const superAdminRouter = createSuperAdminRouter();

export default superAdminRouter;
