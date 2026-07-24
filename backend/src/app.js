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
import authRouter from './modules/auth/auth.routes.js';

const httpLogger = createHttpLogger({
  loggerInstance: logger,
});

export function createApp() {
  const app = express();

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
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
