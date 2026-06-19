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
import { requireCsrf } from './middleware/requireCsrf';
import { env } from '../config';
import { logger } from '../utils/logger';

let server: http.Server | null = null;

export function createServer(): express.Application {
  const app = express();

  if (env.trustProxy) app.set('trust proxy', 1);

  // CRIT-05 / ADR-006: strict CSP — no 'unsafe-inline'. All scripts live in /js/app.js,
  // all styles in /css/styles.css. Programmatic .style.x = y assignments are allowed by
  // CSP (they don't count as inline styles), but new <style> blocks or style="..." in
  // generated HTML will be blocked.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
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

  // ALTA-07 / ADR-0010: stricter limiter for auth endpoints with composite key.
  // Counter is keyed by (ip, username) so a spraying attacker targeting many
  // accounts from one IP cannot share a single counter, and an attacker
  // distributing brute-force across many IPs against a single account still
  // gets caught by the username-keyed bucket.
  app.use('/api/auth/', rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
    skip: (req) => req.path === '/logout',
    keyGenerator: (req) => {
      const body = (req as unknown as { body?: { username?: unknown } }).body;
      const rawName = typeof body?.username === 'string' ? body.username : '';
      const uname = rawName.trim().toLowerCase().slice(0, 64) || '<anon>';
      const ip = req.ip ?? 'unknown';
      return `${ip}|${uname}`;
    },
  }));

  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use('/', pageRoutes);
  // ADR-0016 / Fase 4.C: CSRF double-submit on cookie-authenticated mutating requests.
  // /api/auth/* (login, register, logout) and /api/auth/webauthn/* are exempt because
  // they either have no session yet or use their own challenge mechanism. The
  // middleware also no-ops for Bearer-authenticated callers (legacy / programmatic).
  app.use('/api/auth', authRoutes);
  if (env.enableWebAuthn) app.use('/api/auth/webauthn', webauthnRoutes);
  if (env.enableAi) app.use('/api/ai', requireCsrf, aiRoutes);
  app.use('/api', requireCsrf, apiRoutes);

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
  process.on('unhandledRejection', (reason) => logger.error(`Unhandled rejection: ${String(reason)}`));
}

export function getServer(): http.Server | null { return server; }

if (require.main === module) {
  startServer();
}
