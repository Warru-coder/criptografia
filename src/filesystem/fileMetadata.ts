import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  MAGIC_BYTES,
  FILE_VERSION,
  SALT_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  HEADER_SIZE,
  ENCRYPTED_EXTENSION,
} from '../core/constants';
import { CryptoError, FileError } from '../core/errorHandler';
import { getAppDataPath } from '../core/appConfig';

export interface FileHeader {
  magic: Buffer;
  version: number;
  salt: Buffer;
  iv: Buffer;
  argon2MemoryCost: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
  originalFilename: string;
  originalSize: number;
}

export interface FileMetadata {
  originalPath: string;
  encryptedPath: string;
  originalSize: number;
  encryptedSize: number;
  salt: string;
  iv: string;
  timestamp: string;
  checksum: string;
}

export function buildHeader(
  salt: Buffer,
  iv: Buffer,
  originalPath: string,
  originalSize: number
): Buffer {
  const header = Buffer.alloc(HEADER_SIZE, 0);

  const filename = path.basename(originalPath);
  const filenameBuffer = Buffer.from(filename, 'utf-8');

  let offset = 0;

  MAGIC_BYTES.copy(header, offset);
  offset += MAGIC_BYTES.length;

  header.writeUInt8(FILE_VERSION, offset);
  offset += 1;

  salt.copy(header, offset);
  offset += SALT_LENGTH;

  iv.copy(header, offset);
  offset += IV_LENGTH;

  header.writeUInt32LE(65536, offset);
  offset += 4;
  header.writeUInt8(3, offset);
  offset += 1;
  header.writeUInt8(2, offset);
  offset += 1;

  offset += 8;

  header.writeUInt16LE(filenameBuffer.length, offset);
  offset += 2;

  filenameBuffer.copy(header, offset);
  offset += filenameBuffer.length;

  header.writeBigUInt64LE(BigInt(originalSize), offset);
  offset += 8;

  return header;
}

export function readHeader(filePath: string): FileHeader {
  if (!fs.existsSync(filePath)) {
    throw new FileError(`File not found: ${filePath}`);
  }

  const headerBuffer = fs.readFileSync(filePath, {
    start: 0,
    end: HEADER_SIZE - 1,
  });

  if (headerBuffer.length < HEADER_SIZE) {
    throw new CryptoError('Invalid file header — file may be corrupted');
  }

  let offset = 0;

  const magic = headerBuffer.subarray(offset, offset + MAGIC_BYTES.length);
  offset += MAGIC_BYTES.length;

  if (!magic.equals(MAGIC_BYTES)) {
    throw new CryptoError('Invalid file format — not a SecureCrypt encrypted file');
  }

  const version = headerBuffer.readUInt8(offset);
  offset += 1;

  const salt = headerBuffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = headerBuffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const argon2MemoryCost = headerBuffer.readUInt32LE(offset);
  offset += 4;
  const argon2TimeCost = headerBuffer.readUInt8(offset);
  offset += 1;
  const argon2Parallelism = headerBuffer.readUInt8(offset);
  offset += 1;

  offset += 8;

  const filenameLength = headerBuffer.readUInt16LE(offset);
  offset += 2;

  const originalFilename = headerBuffer
    .subarray(offset, offset + filenameLength)
    .toString('utf-8');
  offset += filenameLength;

  const originalSize = Number(headerBuffer.readBigUInt64LE(offset));

  return {
    magic,
    version,
    salt,
    iv,
    argon2MemoryCost,
    argon2TimeCost,
    argon2Parallelism,
    originalFilename,
    originalSize,
  };
}

export async function writeMetadata(
  originalPath: string,
  encryptedPath: string,
  salt: Buffer,
  iv: Buffer,
  originalSize: number
): Promise<void> {
  const metadataDir = path.join(getAppDataPath(), 'metadata');

  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const fileHash = crypto.createHash('sha256').update(originalPath).digest('hex').slice(0, 16);
  const metadataPath = path.join(metadataDir, `${fileHash}.meta.json`);

  const encryptedStat = fs.statSync(encryptedPath);

  const metadata: FileMetadata = {
    originalPath,
    encryptedPath,
    originalSize,
    encryptedSize: encryptedStat.size,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    timestamp: new Date().toISOString(),
    checksum: crypto.createHash('sha256').update(fs.readFileSync(encryptedPath)).digest('hex'),
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export function readMetadata(encryptedPath: string): FileMetadata | null {
  const metadataDir = path.join(getAppDataPath(), 'metadata');

  if (!fs.existsSync(metadataDir)) {
    return null;
  }

  const files = fs.readdirSync(metadataDir);

  for (const file of files) {
    if (!file.endsWith('.meta.json')) {
      continue;
    }

    const metadataPath = path.join(metadataDir, file);
    const metadata: FileMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    if (metadata.encryptedPath === encryptedPath) {
      return metadata;
    }
  }

  return null;
}
