import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

let tempDb: string;
let currentDb: { closeDb: () => void } | null = null;

async function freshSessionModules() {
  vi.resetModules();
  process.env.SESSION_TTL_MINUTES = '30';

  const db      = await import('../../../src/database/db');
  const users   = await import('../../../src/database/userRepository');
  const store   = await import('../../../src/web/session/sessionStore');
  currentDb = db;
  return { db, users, store };
}

beforeEach(() => {
  tempDb = path.join(
    os.tmpdir(),
    `sc_sess_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`,
  );
  process.env.DB_PATH = tempDb;
  currentDb = null;
});

afterEach(() => {
  if (currentDb) { currentDb.closeDb(); currentDb = null; }
  vi.resetModules();
  const files = [tempDb, `${tempDb}-wal`, `${tempDb}-shm`];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* best-effort */ }
  }
});

describe('sessionStore', () => {
  it('createSession returns a 64-char hex token', async () => {
    const { users, store } = await freshSessionModules();
    const user = users.createUser('alice', 'h', 's');
    const key = Buffer.alloc(32, 0xab);
    const token = store.createSession(key, user.id);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('getSession returns the master key for a valid token', async () => {
    const { users, store } = await freshSessionModules();
    const user = users.createUser('bob', 'h', 's');
    const key = Buffer.alloc(32, 0xcd);
    const token = store.createSession(key, user.id);

    const session = store.getSession(token);
    expect(session).toBeDefined();
    expect(session!.userId).toBe(user.id);
    expect(session!.masterKey.equals(key)).toBe(true);
  });

  it('getSession returns undefined for unknown token', async () => {
    const { store } = await freshSessionModules();
    expect(store.getSession('deadbeef')).toBeUndefined();
  });

  it('deleteSession invalidates the token', async () => {
    const { users, store } = await freshSessionModules();
    const user = users.createUser('carol', 'h', 's');
    const key = Buffer.alloc(32, 0x01);
    const token = store.createSession(key, user.id);

    store.deleteSession(token);
    expect(store.getSession(token)).toBeUndefined();
  });

  it('deleteUserSessions removes all sessions for a user', async () => {
    const { users, store } = await freshSessionModules();
    const user = users.createUser('dave', 'h', 's');
    const k1 = Buffer.alloc(32, 0x01);
    const k2 = Buffer.alloc(32, 0x02);
    const t1 = store.createSession(k1, user.id);
    const t2 = store.createSession(k2, user.id);

    store.deleteUserSessions(user.id);
    expect(store.getSession(t1)).toBeUndefined();
    expect(store.getSession(t2)).toBeUndefined();
  });

  it('SESSION_TTL_MS matches env config', async () => {
    const { store } = await freshSessionModules();
    expect(store.SESSION_TTL_MS).toBe(30 * 60_000);
  });
});
