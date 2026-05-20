import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import {
  AUTH_TAG_LENGTH,
  STREAM_HIGH_WATER_MARK,
} from '../core/constants';
import { deriveFileKey } from './keyDerivation';
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

  const fileKey = await deriveFileKey(masterKey.toString('base64'), salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const header = buildHeader(salt, iv, inputPath, totalSize);
  fs.writeFileSync(outputPath, header);

  const readStream = fs.createReadStream(inputPath, {
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
  const writeStream = fs.createWriteStream(outputPath, { flags: 'a' });

  let bytesProcessed = 0;

  readStream.on('data', (chunk: Buffer) => {
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

  await writeMetadata(inputPath, outputPath, salt, iv, totalSize);

  secureClear(fileKey);
  cipher.destroy();

  return { outputPath, salt, iv, originalSize: totalSize };
}
