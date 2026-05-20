import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import {
  AUTH_TAG_LENGTH,
  HEADER_SIZE,
  STREAM_HIGH_WATER_MARK,
} from '../core/constants';
import { CryptoError, FileError } from '../core/errorHandler';
import { deriveFileKey } from './keyDerivation';
import { secureClear } from './cryptoUtils';
import { readHeader } from '../filesystem/fileMetadata';

export interface DecryptProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
}

export interface DecryptResult {
  outputPath: string;
  originalSize: number;
}

export async function decryptFile(
  inputPath: string,
  outputPath: string,
  masterKey: Buffer,
  onProgress?: (progress: DecryptProgress) => void
): Promise<DecryptResult> {
  const header = readHeader(inputPath);
  const { salt, iv, originalSize, originalFilename } = header;

  const fileKey = await deriveFileKey(masterKey.toString('base64'), salt);

  const fileStat = fs.statSync(inputPath);
  const cipherDataSize = fileStat.size - HEADER_SIZE - AUTH_TAG_LENGTH;

  const authTagBuffer = fs.readFileSync(inputPath, {
    start: HEADER_SIZE + cipherDataSize,
    end: fileStat.size - 1,
  });

  if (authTagBuffer.length !== AUTH_TAG_LENGTH) {
    throw new CryptoError('Invalid auth tag length — file may be corrupted');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTagBuffer);

  const readStream = fs.createReadStream(inputPath, {
    start: HEADER_SIZE,
    end: HEADER_SIZE + cipherDataSize - 1,
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
  const writeStream = fs.createWriteStream(outputPath);

  let bytesProcessed = 0;

  readStream.on('data', (chunk: Buffer) => {
    bytesProcessed += chunk.length;
    if (onProgress) {
      onProgress({
        bytesProcessed,
        totalBytes: cipherDataSize,
        percentage: Math.round((bytesProcessed / cipherDataSize) * 100),
      });
    }
  });

  try {
    await pipeline(readStream, decipher, writeStream);
  } catch (error) {
    throw new CryptoError(
      `Decryption failed — integrity check failed or wrong password: ${(error as Error).message}`
    );
  }

  secureClear(fileKey);
  decipher.destroy();

  return { outputPath, originalSize };
}
