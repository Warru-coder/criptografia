import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`Unhandled error: ${err.message}`);

  if (err.name === 'SecureCryptError') {
    res.status(400).json({
      error: err.message,
      code: (err as { code?: string }).code,
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
  });
}
