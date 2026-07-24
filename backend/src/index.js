import { env } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { startServer, stopServer } from './server.js';

let shutdownStarted = false;

const handleSigint = () => {
  void shutdown('SIGINT');
};
const handleSigterm = () => {
  void shutdown('SIGTERM');
};

const shutdown = async (signal) => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  process.removeListener('SIGINT', handleSigint);
  process.removeListener('SIGTERM', handleSigterm);
  logger.info(
    {
      event: 'application_shutdown_started',
      signal,
    },
    'Application shutdown started.',
  );

  try {
    await stopServer(signal);
    logger.info(
      {
        event: 'application_shutdown_completed',
        signal,
      },
      'Application shutdown completed.',
    );
    process.exitCode = 0;
  } catch {
    logger.error(
      {
        event: 'application_shutdown_failed',
        signal,
      },
      'Application shutdown failed.',
    );
    process.exitCode = 1;
  }
};

process.once('SIGINT', handleSigint);
process.once('SIGTERM', handleSigterm);

try {
  await startServer();

  if (!shutdownStarted) {
    logger.info(
      {
        event: 'application_started',
        port: env.port,
        environment: env.nodeEnv,
      },
      'Client Management Portal API started.',
    );
  }
} catch {
  logger.error(
    {
      event: 'application_startup_failed',
      port: env.port,
      environment: env.nodeEnv,
    },
    'Application startup failed.',
  );
  process.exitCode = 1;

  try {
    await stopServer('startup-failure');
  } catch {
    logger.error(
      {
        event: 'application_shutdown_failed',
        signal: 'startup-failure',
      },
      'Application shutdown failed.',
    );
    process.exitCode = 1;
  }
}
