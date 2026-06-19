import argon2 from 'argon2';
import crypto from 'crypto';
import { CryptoError } from '../core/errorHandler';
import {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
} from '../core/constants';

// ALTA-01 / ADR-0007: HKDF domain separator for file-key derivation.
const FILE_KEY_INFO = Buffer.from('SecureCrypt-v2-file-key');

/**
 * Derives the per-file encryption key from the (already random) masterKey.
 *
 * v2 (current): HKDF-SHA256 — fast (microseconds), separates key purposes via `info`,
 * and is the correct primitive for deriving keys from random material (RFC 5869).
 *
 * Previously (v1) this used Argon2id over masterKey.toString('base64'), which is a
 * category error: Argon2id is meant for low-entropy passwords, not 256-bit keys.
 * It made every file open/save take 200+ms with zero security benefit.
 */
export function deriveFileKeyHKDF(masterKey: Buffer, salt: Buffer): Buffer {
  const ab = crypto.hkdfSync('sha256', masterKey, salt, FILE_KEY_INFO, 32);
  return Buffer.from(ab);
}

export interface KeyDerivationParams {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
}

export const defaultParams: KeyDerivationParams = {
  memoryCost: ARGON2_MEMORY_COST,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
  hashLength: ARGON2_HASH_LENGTH,
};

export async function deriveFileKey(
  password: string,
  salt: Buffer,
  params: KeyDerivationParams = defaultParams
): Promise<Buffer> {
  try {
    const key = await argon2.hash(password, {
      salt,
      type: argon2.argon2id,
      memoryCost: params.memoryCost,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
      hashLength: params.hashLength,
      raw: true,
    });
    return key;
  } catch (error) {
    throw new CryptoError(`File key derivation failed: ${(error as Error).message}`);
  }
}

export async function deriveMasterKey(
  password: string,
  salt: Buffer,
  params: KeyDerivationParams = defaultParams
): Promise<Buffer> {
  return deriveFileKey(password, salt, params);
}
