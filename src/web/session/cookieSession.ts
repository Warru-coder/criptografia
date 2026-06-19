import type { Response, Request } from 'express';
import crypto from 'crypto';
import { env } from '../../config';

// ADR-0016 / Fase 4.C: dual-mode session cookies.
//
// In production we use the __Host- prefix (requires Secure + Path=/ + no Domain).
// In test/dev we drop the prefix and Secure flag so HTTP-only test harnesses
// (supertest, local dev) can exercise the same code paths.

const SECURE = env.nodeEnv === 'production';

export const SESSION_COOKIE = SECURE ? '__Host-sc_session' : 'sc_session';
export const CSRF_COOKIE = SECURE ? '__Host-sc_csrf' : 'sc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function setSessionCookies(res: Response, sessionToken: string, csrfToken: string): void {
  const maxAgeMs = env.sessionTtlMs;
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function readSessionTokenFromCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

export function readCsrfTokenFromCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[CSRF_COOKIE];
}
