import argon2 from 'argon2';
import { CryptoError } from '../core/errorHandler';
import {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
} from '../core/constants';

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
