import { Router } from 'express';

import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { requireRoles, requireTenantContext } from '../auth/auth.authorization.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createProjectController } from './project.controller.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from './project.schemas.js';

export function createProjectRouter(dependencies) {
  const router = Router();
  const controller = createProjectController(dependencies);
  const tenantContextMiddleware = dependencies?.tenantContextMiddleware ?? requireTenantContext;
  const guards = [
    authenticateRequest,
    requireRoles(USER_ROLE.ORGANIZATION_ADMIN),
    tenantContextMiddleware,
  ];

  router.post(
    '/',
    ...guards,
    validateRequest({ body: createProjectSchema }),
    asyncHandler(controller.create),
  );
  router.get(
    '/',
    ...guards,
    validateRequest({ query: listProjectsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:projectId',
    ...guards,
    validateRequest({ params: projectIdParamsSchema }),
    asyncHandler(controller.getById),
  );
  router.patch(
    '/:projectId',
    ...guards,
    validateRequest({ params: projectIdParamsSchema, body: updateProjectSchema }),
    asyncHandler(controller.update),
  );

  return router;
}

export const projectRouter = createProjectRouter();
