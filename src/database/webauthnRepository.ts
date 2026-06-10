import crypto from 'crypto';
import { getDb } from './db';

export interface CredentialRow {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: number;
  createdAt: string;
}

export function saveCredential(
  userId: string,
  credentialId: string,
  publicKey: string,
  counter: number,
  deviceType: string,
  backedUp: boolean,
): CredentialRow {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO webauthn_credentials
      (id, userId, credentialId, publicKey, counter, deviceType, backedUp, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, credentialId, publicKey, counter, deviceType, backedUp ? 1 : 0, now);
  return { id, userId, credentialId, publicKey, counter, deviceType, backedUp: backedUp ? 1 : 0, createdAt: now };
}

export function findCredentialByCredentialId(credentialId: string): CredentialRow | undefined {
  return getDb()
    .prepare('SELECT * FROM webauthn_credentials WHERE credentialId = ?')
    .get(credentialId) as CredentialRow | undefined;
}

export function getCredentialsForUser(userId: string): CredentialRow[] {
  return getDb()
    .prepare('SELECT * FROM webauthn_credentials WHERE userId = ?')
    .all(userId) as CredentialRow[];
}

export function updateCounter(credentialId: string, counter: number): void {
  getDb().prepare('UPDATE webauthn_credentials SET counter = ? WHERE credentialId = ?').run(counter, credentialId);
}

export function deleteCredential(credentialId: string, userId: string): void {
  getDb().prepare('DELETE FROM webauthn_credentials WHERE credentialId = ? AND userId = ?').run(credentialId, userId);
}
