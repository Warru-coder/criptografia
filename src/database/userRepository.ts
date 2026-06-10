import crypto from 'crypto';
import { getDb } from './db';

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  wrappedKey: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export function createUser(username: string, passwordHash: string, salt: string): UserRow {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, passwordHash, salt, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, salt, now);
  return { id, username, passwordHash, salt, wrappedKey: null, createdAt: now, lastLoginAt: null };
}

export function findUserByUsername(username: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function updateLastLogin(userId: string): void {
  getDb().prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(new Date().toISOString(), userId);
}

export function setWrappedKey(userId: string, wrappedKey: string): void {
  getDb().prepare('UPDATE users SET wrappedKey = ? WHERE id = ?').run(wrappedKey, userId);
}

export function usersExist(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  return row.cnt > 0;
}
