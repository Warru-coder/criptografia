import { getDb } from './db';
import { env } from '../config';

export interface SessionRow {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export function persistSession(token: string, userId: string): void {
  const now = Date.now();
  getDb().prepare(`
    INSERT OR REPLACE INTO sessions (token, userId, expiresAt, createdAt)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now + env.sessionTtlMs, now);
}

export function touchSession(token: string): boolean {
  const row = getDb().prepare('SELECT * FROM sessions WHERE token = ?').get(token) as SessionRow | undefined;
  if (!row || row.expiresAt <= Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return false;
  }
  // Slide expiry
  getDb().prepare('UPDATE sessions SET expiresAt = ? WHERE token = ?')
    .run(Date.now() + env.sessionTtlMs, token);
  return true;
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteUserSessions(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
}

export function pruneExpiredSessions(): void {
  getDb().prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(Date.now());
}

export function getSessionUserId(token: string): string | null {
  const row = getDb().prepare('SELECT userId FROM sessions WHERE token = ?').get(token) as Pick<SessionRow, 'userId'> | undefined;
  return row?.userId ?? null;
}
