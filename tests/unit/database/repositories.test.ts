import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

let tempDb: string;
// Hold reference so afterEach can close it before unlinking
let currentDb: { closeDb: () => void } | null = null;

async function freshModules() {
  vi.resetModules();
  process.env.SESSION_TTL_MINUTES = '30';
  const db    = await import('../../../src/database/db');
  const users = await import('../../../src/database/userRepository');
  const sess  = await import('../../../src/database/sessionRepository');
  const wa    = await import('../../../src/database/webauthnRepository');
  currentDb = db;
  return { db, users, sess, wa };
}

beforeEach(() => {
  tempDb = path.join(
    os.tmpdir(),
    `sc_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`,
  );
  process.env.DB_PATH = tempDb;
  currentDb = null;
});

afterEach(() => {
  // Close DB first so Windows releases the file lock
  if (currentDb) { currentDb.closeDb(); currentDb = null; }
  vi.resetModules();
  // Give SQLite a tick to flush WAL before deleting
  const files = [tempDb, `${tempDb}-wal`, `${tempDb}-shm`];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* best-effort */ }
  }
});

// ─── userRepository ────────────────────────────────────────────────────────────

describe('userRepository', () => {
  it('creates a user and finds it by username', async () => {
    const { users } = await freshModules();
    const user = users.createUser('alice', 'hash123', 'salt64');
    expect(user.username).toBe('alice');
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(users.findUserByUsername('alice')?.id).toBe(user.id);
  });

  it('returns undefined for unknown username', async () => {
    const { users } = await freshModules();
    expect(users.findUserByUsername('nobody')).toBeUndefined();
  });

  it('rejects duplicate usernames', async () => {
    const { users } = await freshModules();
    users.createUser('bob', 'h', 's');
    expect(() => users.createUser('bob', 'h2', 's2')).toThrow();
  });

  it('finds user by id', async () => {
    const { users } = await freshModules();
    const user = users.createUser('carol', 'h', 's');
    expect(users.findUserById(user.id)?.username).toBe('carol');
  });

  it('updateLastLogin sets lastLoginAt', async () => {
    const { users } = await freshModules();
    const user = users.createUser('dave', 'h', 's');
    expect(users.findUserById(user.id)?.lastLoginAt).toBeNull();
    users.updateLastLogin(user.id);
    expect(users.findUserById(user.id)?.lastLoginAt).toBeTruthy();
  });

  it('usersExist returns false when empty, true after insert', async () => {
    const { users } = await freshModules();
    expect(users.usersExist()).toBe(false);
    users.createUser('eve', 'h', 's');
    expect(users.usersExist()).toBe(true);
  });

  it('setWrappedKey updates the field', async () => {
    const { users } = await freshModules();
    const user = users.createUser('frank', 'h', 's');
    users.setWrappedKey(user.id, 'wrapped_base64==');
    expect(users.findUserById(user.id)?.wrappedKey).toBe('wrapped_base64==');
  });
});

// ─── sessionRepository ─────────────────────────────────────────────────────────

describe('sessionRepository', () => {
  it('persists a session and retrieves userId', async () => {
    const { users, sess } = await freshModules();
    const user = users.createUser('alice', 'h', 's');
    sess.persistSession('tok1', user.id);
    expect(sess.getSessionUserId('tok1')).toBe(user.id);
  });

  it('returns null for unknown token', async () => {
    const { sess } = await freshModules();
    expect(sess.getSessionUserId('nonexistent')).toBeNull();
  });

  it('deleteSession removes the session', async () => {
    const { users, sess } = await freshModules();
    const user = users.createUser('bob', 'h', 's');
    sess.persistSession('tok2', user.id);
    sess.deleteSession('tok2');
    expect(sess.getSessionUserId('tok2')).toBeNull();
  });

  it('deleteUserSessions removes all sessions for a user', async () => {
    const { users, sess } = await freshModules();
    const user = users.createUser('carol', 'h', 's');
    sess.persistSession('tok3', user.id);
    sess.persistSession('tok4', user.id);
    sess.deleteUserSessions(user.id);
    expect(sess.getSessionUserId('tok3')).toBeNull();
    expect(sess.getSessionUserId('tok4')).toBeNull();
  });

  it('touchSession returns false for an expired session', async () => {
    const { users, db, sess } = await freshModules();
    const user = users.createUser('dave', 'h', 's');
    db.getDb()
      .prepare('INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)')
      .run('expired_tok', user.id, Date.now() - 1000, Date.now() - 2000);
    expect(sess.touchSession('expired_tok')).toBe(false);
  });

  it('pruneExpiredSessions removes stale rows', async () => {
    const { users, db, sess } = await freshModules();
    const user = users.createUser('eve', 'h', 's');
    db.getDb()
      .prepare('INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)')
      .run('stale_tok', user.id, Date.now() - 5000, Date.now() - 10000);
    sess.pruneExpiredSessions();
    expect(sess.getSessionUserId('stale_tok')).toBeNull();
  });
});

// ─── webauthnRepository ────────────────────────────────────────────────────────

describe('webauthnRepository', () => {
  it('saves and retrieves a credential by credentialId', async () => {
    const { users, wa } = await freshModules();
    const user = users.createUser('alice', 'h', 's');
    const cred = wa.saveCredential(user.id, 'cred_id_1', 'pubkey_base64', 0, 'platform', true);
    expect(cred.userId).toBe(user.id);
    expect(wa.findCredentialByCredentialId('cred_id_1')?.publicKey).toBe('pubkey_base64');
    expect(wa.findCredentialByCredentialId('cred_id_1')?.backedUp).toBe(1);
  });

  it('returns undefined for unknown credentialId', async () => {
    const { wa } = await freshModules();
    expect(wa.findCredentialByCredentialId('no_such')).toBeUndefined();
  });

  it('getCredentialsForUser returns all credentials for a user', async () => {
    const { users, wa } = await freshModules();
    const user = users.createUser('bob', 'h', 's');
    wa.saveCredential(user.id, 'cid_a', 'pk_a', 0, 'platform', false);
    wa.saveCredential(user.id, 'cid_b', 'pk_b', 0, 'cross-platform', true);
    expect(wa.getCredentialsForUser(user.id)).toHaveLength(2);
  });

  it('updateCounter updates the counter field', async () => {
    const { users, wa } = await freshModules();
    const user = users.createUser('carol', 'h', 's');
    wa.saveCredential(user.id, 'cid_c', 'pk_c', 0, 'platform', false);
    wa.updateCounter('cid_c', 42);
    expect(wa.findCredentialByCredentialId('cid_c')?.counter).toBe(42);
  });

  it('deleteCredential removes only the targeted credential', async () => {
    const { users, wa } = await freshModules();
    const user = users.createUser('dave', 'h', 's');
    wa.saveCredential(user.id, 'cid_d', 'pk_d', 0, 'platform', false);
    wa.saveCredential(user.id, 'cid_e', 'pk_e', 0, 'platform', false);
    wa.deleteCredential('cid_d', user.id);
    expect(wa.findCredentialByCredentialId('cid_d')).toBeUndefined();
    expect(wa.getCredentialsForUser(user.id)).toHaveLength(1);
  });
});
