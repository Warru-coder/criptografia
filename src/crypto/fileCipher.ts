import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import {
  AUTH_TAG_LENGTH,
  STREAM_HIGH_WATER_MARK,
  FILE_VERSION_V2,
} from '../core/constants';
import { deriveFileKeyHKDF } from './keyDerivation';
import { generateIv, generateSalt, secureClear } from './cryptoUtils';
import { buildHeader, writeMetadata } from '../filesystem/fileMetadata';

export interface EncryptProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
}

export interface EncryptResult {
  outputPath: string;
  salt: Buffer;
  iv: Buffer;
  originalSize: number;
}

export async function encryptFile(
  inputPath: string,
  outputPath: string,
  masterKey: Buffer,
  onProgress?: (progress: EncryptProgress) => void
): Promise<EncryptResult> {
  const fileStat = fs.statSync(inputPath);
  const totalSize = fileStat.size;

  const salt = generateSalt();
  const iv = generateIv();

  // ALTA-01 / ADR-0007: HKDF instead of Argon2id-over-key.
  const fileKey = deriveFileKeyHKDF(masterKey, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const header = buildHeader(salt, iv, inputPath, totalSize, FILE_VERSION_V2);
  fs.writeFileSync(outputPath, header);

  const readStream = fs.createReadStream(inputPath, {
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
  const writeStream = fs.createWriteStream(outputPath, { flags: 'a' });

  let bytesProcessed = 0;

  readStream.on('data', (chunk) => {
    bytesProcessed += chunk.length;
    if (onProgress) {
      onProgress({
        bytesProcessed,
        totalBytes: totalSize,
        percentage: Math.round((bytesProcessed / totalSize) * 100),
      });
    }
  });

  await pipeline(readStream, cipher, writeStream);

  const authTag = cipher.getAuthTag();
  fs.appendFileSync(outputPath, authTag);

  writeMetadata(inputPath, outputPath, salt, iv, totalSize);

  secureClear(fileKey);
  cipher.destroy();

  return { outputPath, salt, iv, originalSize: totalSize };
}
