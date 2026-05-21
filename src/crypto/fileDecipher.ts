import crypto from 'crypto';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import {
  AUTH_TAG_LENGTH,
  HEADER_SIZE,
  STREAM_HIGH_WATER_MARK,
} from '../core/constants';
import { CryptoError } from '../core/errorHandler';
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
  const header = await readHeader(inputPath);
  const { salt, iv, originalSize } = header;

  const fileStat = fs.statSync(inputPath);
  const cipherDataSize = fileStat.size - HEADER_SIZE - AUTH_TAG_LENGTH;

  if (cipherDataSize < 0) {
    throw new CryptoError('Invalid encrypted file size - file may be corrupted');
  }

  const authTagStream = fs.createReadStream(inputPath, {
    start: HEADER_SIZE + cipherDataSize,
    end: fileStat.size - 1,
  });

  const authTagBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    authTagStream.on('data', (chunk) => chunks.push(chunk as Uint8Array));
    authTagStream.on('end', () => resolve(Buffer.concat(chunks)));
    authTagStream.on('error', reject);
  });

  if (authTagBuffer.length !== AUTH_TAG_LENGTH) {
    throw new CryptoError('Invalid auth tag length - file may be corrupted');
  }

  const fileKey = await deriveFileKey(masterKey.toString('base64'), salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTagBuffer);

  try {
    if (cipherDataSize === 0) {
      const finalBuffer = decipher.final();
      fs.writeFileSync(outputPath, finalBuffer);

      if (onProgress) {
        onProgress({
          bytesProcessed: 0,
          totalBytes: 0,
          percentage: 100,
        });
      }

      return { outputPath, originalSize };
    }

    const readStream = fs.createReadStream(inputPath, {
      start: HEADER_SIZE,
      end: HEADER_SIZE + cipherDataSize - 1,
      highWaterMark: STREAM_HIGH_WATER_MARK,
    });
    const writeStream = fs.createWriteStream(outputPath);

    let bytesProcessed = 0;

    readStream.on('data', (chunk) => {
      bytesProcessed += chunk.length;
      if (onProgress) {
        onProgress({
          bytesProcessed,
          totalBytes: cipherDataSize,
          percentage: Math.round((bytesProcessed / cipherDataSize) * 100),
        });
      }
    });

    await pipeline(readStream, decipher, writeStream);

    return { outputPath, originalSize };
  } catch (error) {
    throw new CryptoError(
      `Decryption failed - integrity check failed or wrong password: ${(error as Error).message}`
    );
  } finally {
    secureClear(fileKey);
    decipher.destroy();
  }
}
