import { Router } from 'express';

import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { requireRoles, requireTenantContext } from '../auth/auth.authorization.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createProjectFileController } from './project-file.controller.js';
import {
  listProjectFilesQuerySchema,
  projectFileParamsSchema,
  projectFilesParamsSchema,
  updateProjectFileSchema,
  uploadProjectFileFieldsSchema,
} from './project-file.schemas.js';
import { projectFileUploadMiddleware } from './project-file-upload.middleware.js';

export function createProjectFileRouter(dependencies = {}) {
  const router = Router({ mergeParams: true });
  const controller = createProjectFileController(dependencies);
  const uploadMiddleware = dependencies.projectFileUploadMiddleware ?? projectFileUploadMiddleware;
  const tenantContextMiddleware = dependencies.tenantContextMiddleware ?? requireTenantContext;
  const guards = [
    authenticateRequest,
    requireRoles(USER_ROLE.ORGANIZATION_ADMIN),
    tenantContextMiddleware,
  ];

  router.post(
    '/',
    ...guards,
    validateRequest({ params: projectFilesParamsSchema }),
    uploadMiddleware,
    validateRequest({
      params: projectFilesParamsSchema,
      body: uploadProjectFileFieldsSchema,
    }),
    asyncHandler(controller.upload),
  );
  router.get(
    '/',
    ...guards,
    validateRequest({
      params: projectFilesParamsSchema,
      query: listProjectFilesQuerySchema,
    }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:fileId/download',
    ...guards,
    validateRequest({ params: projectFileParamsSchema }),
    asyncHandler(controller.download),
  );
  router.get(
    '/:fileId',
    ...guards,
    validateRequest({ params: projectFileParamsSchema }),
    asyncHandler(controller.getById),
  );
  router.patch(
    '/:fileId',
    ...guards,
    validateRequest({
      params: projectFileParamsSchema,
      body: updateProjectFileSchema,
    }),
    asyncHandler(controller.update),
  );

  return router;
}

export const projectFileRouter = createProjectFileRouter();
