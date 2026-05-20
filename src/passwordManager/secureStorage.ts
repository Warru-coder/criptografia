import fs from 'fs';
import path from 'path';
import { getAppDataPath, ensureAppDataDirs } from '../core/appConfig';
import { deriveKeyForStorage, verifyPassword, secureClear } from '../crypto/cryptoUtils';
import { PasswordError } from '../core/errorHandler';

export interface MasterPasswordRecord {
  algorithm: string;
  version: number;
  params: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  hash: string;
  salt: string;
  createdAt: string;
}

export async function setupMasterPassword(password: string): Promise<void> {
  ensureAppDataDirs();

  const vaultPath = path.join(getAppDataPath(), 'vault', 'master.hash');

  if (fs.existsSync(vaultPath)) {
    throw new PasswordError('Master password is already set. Use verify to check.');
  }

  const { hash, salt } = await deriveKeyForStorage(password);

  const record: MasterPasswordRecord = {
    algorithm: 'argon2id',
    version: 19,
    params: {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 2,
    },
    hash,
    salt: salt.toString('base64'),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(vaultPath, JSON.stringify(record, null, 2), 'utf-8');
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const vaultPath = path.join(getAppDataPath(), 'vault', 'master.hash');

  if (!fs.existsSync(vaultPath)) {
    throw new PasswordError('No master password set. Run init first.');
  }

  const record: MasterPasswordRecord = JSON.parse(
    fs.readFileSync(vaultPath, 'utf-8')
  );

  return verifyPassword(record.hash, password);
}

export async function getMasterKey(password: string): Promise<Buffer> {
  const vaultPath = path.join(getAppDataPath(), 'vault', 'master.hash');

  if (!fs.existsSync(vaultPath)) {
    throw new PasswordError('No master password set. Run init first.');
  }

  const record: MasterPasswordRecord = JSON.parse(
    fs.readFileSync(vaultPath, 'utf-8')
  );

  const salt = Buffer.from(record.salt, 'base64');
  const key = await deriveKeyForStorage(password, salt);

  return Buffer.from(key.hash);
}

export function isVaultInitialized(): boolean {
  const vaultPath = path.join(getAppDataPath(), 'vault', 'master.hash');
  return fs.existsSync(vaultPath);
}
