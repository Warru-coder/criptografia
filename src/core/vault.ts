import fs from 'fs';
import path from 'path';
import { dataDir, ensureDirs } from './config';
import { hashPassword, verifyPassword, deriveKey } from '../crypto/engine';

interface VaultRecord {
  algorithm: string;
  version: number;
  params: { memoryCost: number; timeCost: number; parallelism: number };
  hash: string;
  salt: string;
  createdAt: string;
}

function vaultPath(): string {
  return path.join(dataDir(), 'vault', 'master.hash');
}

export function isInitialized(): boolean {
  return fs.existsSync(vaultPath());
}

export async function initVault(password: string): Promise<void> {
  ensureDirs();
  if (isInitialized()) throw new Error('Vault already initialized');
  const { hash, salt } = await hashPassword(password);
  const record: VaultRecord = {
    algorithm: 'argon2id', version: 19,
    params: { memoryCost: 65536, timeCost: 3, parallelism: 2 },
    hash, salt: salt.toString('base64'), createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(vaultPath(), JSON.stringify(record, null, 2));
}

export async function verifyMaster(password: string): Promise<boolean> {
  if (!isInitialized()) throw new Error('Vault not initialized');
  const record: VaultRecord = JSON.parse(fs.readFileSync(vaultPath(), 'utf-8'));
  return verifyPassword(record.hash, password);
}

export async function getMasterKey(password: string): Promise<Buffer> {
  if (!isInitialized()) throw new Error('Vault not initialized');
  const record: VaultRecord = JSON.parse(fs.readFileSync(vaultPath(), 'utf-8'));
  const salt = Buffer.from(record.salt, 'base64');
  return deriveKey(password, salt);
}
