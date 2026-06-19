import fs from 'fs';
import path from 'path';
import { env, ensureAppDataDirs } from '../config';
import { deriveKey, deriveKeyForStorage, verifyPassword } from '../crypto/cryptoUtils';
import { PasswordError } from '../core/errorHandler';

export interface MasterPasswordRecord {
  algorithm: string;
  version: number;
  params: { memoryCost: number; timeCost: number; parallelism: number };
  hash: string;
  salt: string;
  createdAt: string;
}

// ─── Per-user vault paths ─────────────────────────────────────────────────────

export function userVaultDir(userId: string): string {
  return path.join(env.usersDir, userId, 'vault');
}

function vaultFilePath(userId: string): string {
  return path.join(userVaultDir(userId), 'master.hash');
}

export function isVaultInitialized(userId: string): boolean {
  return fs.existsSync(vaultFilePath(userId));
}

// ─── Vault lifecycle ──────────────────────────────────────────────────────────

export async function setupMasterPassword(userId: string, password: string): Promise<void> {
  ensureAppDataDirs();

  const vaultDir = userVaultDir(userId);
  if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

  if (isVaultInitialized(userId)) {
    throw new PasswordError('Master password is already set for this user.');
  }

  const { hash, salt } = await deriveKeyForStorage(password);

  const record: MasterPasswordRecord = {
    algorithm: 'argon2id',
    version: 19,
    params: { memoryCost: 65536, timeCost: 3, parallelism: 2 },
    hash,
    salt: salt.toString('base64'),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(vaultFilePath(userId), JSON.stringify(record, null, 2), 'utf-8');
}

export async function verifyMasterPassword(userId: string, password: string): Promise<boolean> {
  if (!isVaultInitialized(userId)) throw new PasswordError('Vault not initialized for this user.');
  const record: MasterPasswordRecord = JSON.parse(fs.readFileSync(vaultFilePath(userId), 'utf-8'));
  return verifyPassword(record.hash, password);
}

export async function getMasterKey(userId: string, password: string): Promise<Buffer> {
  if (!isVaultInitialized(userId)) throw new PasswordError('Vault not initialized for this user.');
  const record: MasterPasswordRecord = JSON.parse(fs.readFileSync(vaultFilePath(userId), 'utf-8'));
  const salt = Buffer.from(record.salt, 'base64');
  return deriveKey(password, salt);
}

/**
 * MED-04 / ADR-0014: atomic password rotation.
 *
 * Re-derives both the storage hash and the masterKey-derivation salt, persists
 * them, and returns the new masterKey. Caller is responsible for invalidating
 * the user's sessions (except possibly the current one) and any wrapped keys
 * derived from the old masterKey.
 *
 * Atomicity: we write the new vault file to a sibling path and rename. If the
 * rename fails the old vault is untouched.
 */
export async function changeMasterPassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<Buffer> {
  if (!isVaultInitialized(userId)) throw new PasswordError('Vault not initialized for this user.');

  const ok = await verifyMasterPassword(userId, oldPassword);
  if (!ok) throw new PasswordError('Current password is incorrect.');

  const { hash, salt } = await deriveKeyForStorage(newPassword);
  const record: MasterPasswordRecord = {
    algorithm: 'argon2id',
    version: 19,
    params: { memoryCost: 65536, timeCost: 3, parallelism: 2 },
    hash,
    salt: salt.toString('base64'),
    createdAt: new Date().toISOString(),
  };

  const finalPath = vaultFilePath(userId);
  const tmpPath = finalPath + '.new';
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf-8');
  fs.renameSync(tmpPath, finalPath);

  return deriveKey(newPassword, salt);
}

// ─── Legacy single-user compat (CLI / init command) ──────────────────────────
// The CLI uses a shared "default" user stored under userId = 'default'.

const DEFAULT_USER_ID = 'default';

export async function setupMasterPasswordLegacy(password: string): Promise<void> {
  return setupMasterPassword(DEFAULT_USER_ID, password);
}

export async function verifyMasterPasswordLegacy(password: string): Promise<boolean> {
  return verifyMasterPassword(DEFAULT_USER_ID, password);
}

export async function getMasterKeyLegacy(password: string): Promise<Buffer> {
  return getMasterKey(DEFAULT_USER_ID, password);
}

export function isVaultInitializedLegacy(): boolean {
  return isVaultInitialized(DEFAULT_USER_ID);
}
