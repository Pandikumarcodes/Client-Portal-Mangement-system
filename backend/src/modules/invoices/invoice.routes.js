import { Router } from 'express';

import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { requireRoles, requireTenantContext } from '../auth/auth.authorization.js';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { USER_ROLE } from '../users/user.constants.js';
import { createInvoiceController } from './invoice.controller.js';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  projectInvoiceParamsSchema,
  projectInvoicesParamsSchema,
  updateInvoiceSchema,
} from './invoice.schemas.js';

export function createInvoiceRouter(dependencies) {
  const router = Router({ mergeParams: true });
  const controller = createInvoiceController(dependencies);
  const guards = [
    authenticateRequest,
    requireRoles(USER_ROLE.ORGANIZATION_ADMIN),
    requireTenantContext,
  ];

  router.post(
    '/',
    ...guards,
    validateRequest({
      params: projectInvoicesParamsSchema,
      body: createInvoiceSchema,
    }),
    asyncHandler(controller.create),
  );
  router.get(
    '/',
    ...guards,
    validateRequest({
      params: projectInvoicesParamsSchema,
      query: listInvoicesQuerySchema,
    }),
    asyncHandler(controller.list),
  );
  router.get(
    '/:invoiceId',
    ...guards,
    validateRequest({ params: projectInvoiceParamsSchema }),
    asyncHandler(controller.getById),
  );
  router.patch(
    '/:invoiceId',
    ...guards,
    validateRequest({
      params: projectInvoiceParamsSchema,
      body: updateInvoiceSchema,
    }),
    asyncHandler(controller.update),
  );

  return router;
}

export const invoiceRouter = createInvoiceRouter();
