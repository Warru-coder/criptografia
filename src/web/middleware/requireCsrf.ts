import type { Request, Response, NextFunction } from 'express';
import { CSRF_HEADER, readCsrfTokenFromCookie, readSessionTokenFromCookie } from '../session/cookieSession';

// ADR-0016 / Fase 4.C: CSRF double-submit middleware.
//
// Applies only to state-changing methods (POST/PUT/PATCH/DELETE). For cookie-based
// sessions we require the client to echo the CSRF cookie back via the X-CSRF-Token
// header — this is impossible from a cross-site request because the attacker cannot
// read the cookie.
//
// Requests authenticated via Bearer header (legacy / programmatic clients) are NOT
// subject to CSRF, because a CSRF attack cannot set an Authorization header from a
// foreign origin. This preserves backwards compatibility during the dual-mode
// migration described in ADR-0016.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  // Only enforce CSRF when the caller is using the cookie-based session.
  // Bearer header → no ambient credential → CSRF not applicable.
  const sessionFromCookie = readSessionTokenFromCookie(req);
  if (!sessionFromCookie) return next();

  const csrfCookie = readCsrfTokenFromCookie(req);
  const csrfHeader = req.headers[CSRF_HEADER];
  if (!csrfCookie || typeof csrfHeader !== 'string' || csrfHeader.length === 0) {
    res.status(403).json({ error: 'CSRF token missing.' });
    return;
  }

  // Constant-time comparison.
  const a = Buffer.from(csrfCookie);
  const b = Buffer.from(csrfHeader);
  if (a.length !== b.length) {
    res.status(403).json({ error: 'CSRF token invalid.' });
    return;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    res.status(403).json({ error: 'CSRF token invalid.' });
    return;
  }

  next();
}
