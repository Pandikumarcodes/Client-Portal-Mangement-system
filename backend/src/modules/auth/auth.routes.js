import { Router } from 'express';

import { asyncHandler } from '../../core/errors/async-handler.js';
import { validateRequest } from '../../core/validation/validate-request.js';
import { createAuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export function createAuthRouter(dependencies) {
  const router = Router();
  const authController = createAuthController(dependencies);

  router.post(
    '/register',
    validateRequest({ body: registerSchema }),
    asyncHandler(authController.register),
  );
  router.post('/login', validateRequest({ body: loginSchema }), asyncHandler(authController.login));
  router.post('/refresh', asyncHandler(authController.refresh));
  router.post('/logout', authController.logout);

  return router;
}

export const authRouter = createAuthRouter();

export default authRouter;
