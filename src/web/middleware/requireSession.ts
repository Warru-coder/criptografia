import { Request, Response, NextFunction } from 'express';
import { getSession } from '../session/sessionStore';
import { readSessionTokenFromCookie } from '../session/cookieSession';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      masterKey: Buffer;
      userId: string;
    }
  }
}

// ADR-0016 / Fase 4.C: dual-mode session.
// Prefer the HttpOnly cookie (resistant to XSS). Fall back to Authorization: Bearer
// for programmatic clients and during the migration window described in ADR-0016.
function extractSessionToken(req: Request): string | undefined {
  const fromCookie = readSessionTokenFromCookie(req);
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. POST /api/auth/login first.' });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  req.masterKey = session.masterKey;
  req.userId = session.userId;
  next();
}
