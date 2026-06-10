import express from 'express';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { apiRoutes } from './routes/apiRoutes';
import { authRoutes } from './routes/authRoutes';
import { pageRoutes } from './routes/pageRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { logger } from '../utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

let server: http.Server | null = null;

export function createServer(): express.Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use('/', pageRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);

  app.use(errorMiddleware);

  return app;
}

export function startServer(): http.Server {
  const app = createServer();
  server = app.listen(PORT, () => {
    logger.info(`SecureCrypt Web UI running on http://localhost:${PORT}`);
  });

  setupGracefulShutdown(server);
  return server;
}

function setupGracefulShutdown(serverInstance: http.Server): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    serverInstance.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}

export function getServer(): http.Server | null {
  return server;
}

if (require.main === module) {
  startServer();
}
