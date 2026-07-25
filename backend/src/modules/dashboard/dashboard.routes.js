import { Router } from 'express';
import { asyncHandler } from '../../core/errors/async-handler.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { requireRoles, requireTenantContext } from '../auth/auth.authorization.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createDashboardController } from './dashboard.controller.js';

export function createDashboardRouter(dependencies) {
  const router = Router();
  const controller = createDashboardController(dependencies);
  router.get(
    '/organization',
    authenticateRequest,
    requireRoles(USER_ROLE.ORGANIZATION_ADMIN),
    requireTenantContext,
    asyncHandler(controller.getOrganization),
  );
  return router;
}

export const dashboardRouter = createDashboardRouter();
