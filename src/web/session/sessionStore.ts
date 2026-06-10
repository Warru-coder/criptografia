import crypto from 'crypto';
import { env } from '../../config';
import {
  persistSession,
  touchSession,
  deleteSession as dbDeleteSession,
  deleteUserSessions as dbDeleteUserSessions,
  pruneExpiredSessions,
} from '../../database/sessionRepository';

// In-memory store: only holds the master key (never persisted to disk)
interface MemEntry {
  masterKey: Buffer;
  userId: string;
}

const mem = new Map<string, MemEntry>();

// Purge expired sessions from DB and memory every minute
const cleanup = setInterval(() => {
  pruneExpiredSessions();
  for (const token of mem.keys()) {
    if (!touchSession(token)) {
      const entry = mem.get(token);
      if (entry) entry.masterKey.fill(0);
      mem.delete(token);
    }
  }
}, 60_000);
cleanup.unref();

export function createSession(masterKey: Buffer, userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  persistSession(token, userId);
  mem.set(token, { masterKey: Buffer.from(masterKey), userId });
  return token;
}

export interface Session {
  masterKey: Buffer;
  userId: string;
}

export function getSession(token: string): Session | undefined {
  const entry = mem.get(token);
  if (!entry) return undefined;

  // Verify + slide expiry in DB
  if (!touchSession(token)) {
    entry.masterKey.fill(0);
    mem.delete(token);
    return undefined;
  }

  return entry;
}

export function deleteSession(token: string): void {
  const entry = mem.get(token);
  if (entry) {
    entry.masterKey.fill(0);
    mem.delete(token);
  }
  dbDeleteSession(token);
}

export function deleteUserSessions(userId: string): void {
  for (const [token, entry] of mem.entries()) {
    if (entry.userId === userId) {
      entry.masterKey.fill(0);
      mem.delete(token);
    }
  }
  dbDeleteUserSessions(userId);
}

// Kept for backwards compatibility
export const SESSION_TTL_MS = env.sessionTtlMs;
