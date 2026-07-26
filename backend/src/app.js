import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import healthRouter from './core/health/health.routes.js';
import { createHttpLogger } from './core/logging/http-logger.js';
import { logger } from './core/logging/logger.js';
import { requestContextMiddleware } from './core/logging/request-context.js';
import { requestIdMiddleware } from './core/logging/request-id.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';
import { createRequireActiveTenantContext } from './modules/auth/auth.authorization.js';
import authRouter from './modules/auth/auth.routes.js';
import { createClientRouter } from './modules/clients/client.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createInvoiceRouter } from './modules/invoices/invoice.routes.js';
import { createProjectFileRouter } from './modules/project-files/project-file.routes.js';
import { createProjectRouter } from './modules/projects/project.routes.js';
import { superAdminRouter } from './modules/super-admin/super-admin.routes.js';

const httpLogger = createHttpLogger({
  loggerInstance: logger,
});

export function createApp() {
  const app = express();
  const tenantContextMiddleware = createRequireActiveTenantContext();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(requestContextMiddleware);
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin(requestOrigin, callback) {
        callback(null, !requestOrigin || requestOrigin === env.clientUrl);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/clients', createClientRouter({ tenantContextMiddleware }));
  app.use('/api/v1/projects', createProjectRouter({ tenantContextMiddleware }));
  app.use(
    '/api/v1/projects/:projectId/files',
    createProjectFileRouter({ tenantContextMiddleware }),
  );
  app.use('/api/v1/projects/:projectId/invoices', createInvoiceRouter({ tenantContextMiddleware }));
  app.use('/api/v1/dashboard', createDashboardRouter({ tenantContextMiddleware }));
  app.use('/api/v1/super-admin', superAdminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
