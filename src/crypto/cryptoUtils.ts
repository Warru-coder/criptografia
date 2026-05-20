import crypto from 'crypto';
import argon2 from 'argon2';
import {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
  SALT_LENGTH,
  IV_LENGTH,
} from '../core/constants';
import { CryptoError } from '../core/errorHandler';

export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

export function generateIv(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

export async function deriveKey(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  try {
    const key = await argon2.hash(password, {
      salt,
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_LENGTH,
      raw: true,
    });
    return key;
  } catch (error) {
    throw new CryptoError(`Key derivation failed: ${(error as Error).message}`);
  }
}

export async function deriveKeyForStorage(
  password: string,
  salt?: Buffer
): Promise<{ hash: string; salt: Buffer }> {
  const saltToUse = salt || generateSalt();

  try {
    const hash = await argon2.hash(password, {
      salt: saltToUse,
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_LENGTH,
      raw: false,
    });

    return { hash, salt: saltToUse };
  } catch (error) {
    throw new CryptoError(`Password hashing failed: ${(error as Error).message}`);
  }
}

export async function verifyPassword(
  storedHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

export function secureClear(buffer: Buffer): void {
  buffer.fill(0);
}
