import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config';

if (!fs.existsSync(env.logDir)) fs.mkdirSync(env.logDir, { recursive: true });

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'securecrypt' },
  transports: [
    new winston.transports.File({
      filename: path.join(env.logDir, 'secure.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

if (env.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
