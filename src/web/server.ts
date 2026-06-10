import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { apiRoutes } from './routes/apiRoutes';
import { authRoutes } from './routes/authRoutes';
import { webauthnRoutes } from './routes/webauthnRoutes';
import { aiRoutes } from './routes/aiRoutes';
import { pageRoutes } from './routes/pageRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { env } from '../config';
import { logger } from '../utils/logger';

let server: http.Server | null = null;

export function createServer(): express.Application {
  const app = express();

  if (env.trustProxy) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  }));

  if (env.corsOrigins.length > 0) {
    app.use(cors({
      origin: env.corsOrigins,
      credentials: true,
    }));
  }

  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global rate limiter
  app.use('/api/', rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }));

  // Stricter limiter for auth endpoints
  app.use('/api/auth/', rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
    skip: (req) => req.path === '/logout',
  }));

  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use('/', pageRoutes);
  app.use('/api/auth', authRoutes);
  if (env.enableWebAuthn) app.use('/api/auth/webauthn', webauthnRoutes);
  if (env.enableAi) app.use('/api/ai', aiRoutes);
  app.use('/api', apiRoutes);

  app.use(errorMiddleware);

  return app;
}

export function startServer(): http.Server {
  const app = createServer();
  server = app.listen(env.port, env.host, () => {
    logger.info(`SecureCrypt running on http://${env.host}:${env.port} [${env.nodeEnv}]`);
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
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => logger.error(`Uncaught exception: ${error.message}`));
  process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${reason}`));
}

export function getServer(): http.Server | null { return server; }

if (require.main === module) {
  startServer();
}
