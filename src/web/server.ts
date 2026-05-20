import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { apiRoutes } from './routes/apiRoutes';
import { pageRoutes } from './routes/pageRoutes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { logger } from '../utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);

export function createServer(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use('/', pageRoutes);
  app.use('/api', apiRoutes);

  app.use(errorMiddleware);

  return app;
}

export function startServer(): void {
  const app = createServer();

  app.listen(PORT, () => {
    logger.info(`SecureCrypt Web UI running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}
