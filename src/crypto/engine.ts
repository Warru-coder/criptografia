import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import argon2 from 'argon2';

export const MAGIC = Buffer.from('SCRYPT');
export const VERSION = 1;
export const SALT_LEN = 16;
export const IV_LEN = 16;
export const TAG_LEN = 16;
export const HDR_LEN = 128;
export const EXT = '.scrypt';
export const BUF_SIZE = 64 * 1024;

export const ARGON2_PARAMS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 2,
  hashLength: 32,
};

export function genSalt(): Buffer {
  return crypto.randomBytes(SALT_LEN);
}

export function genIv(): Buffer {
  return crypto.randomBytes(IV_LEN);
}

export async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return argon2.hash(password, {
    salt,
    type: argon2.argon2id,
    ...ARGON2_PARAMS,
    raw: true,
  });
}

export async function hashPassword(password: string, salt?: Buffer): Promise<{ hash: string; salt: Buffer }> {
  const s = salt || genSalt();
  const hash = await argon2.hash(password, {
    salt: s,
    type: argon2.argon2id,
    ...ARGON2_PARAMS,
    raw: false,
  });
  return { hash, salt: s };
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

export function secureClear(buf: Buffer): void {
  buf.fill(0);
}

export interface Header {
  salt: Buffer;
  iv: Buffer;
  filename: string;
  originalSize: number;
}

export function buildHeader(salt: Buffer, iv: Buffer, filename: string, size: number): Buffer {
  const h = Buffer.alloc(HDR_LEN, 0);
  const fnBuf = Buffer.from(filename, 'utf-8');
  let o = 0;
  MAGIC.copy(h, o); o += MAGIC.length;
  h.writeUInt8(VERSION, o); o += 1;
  salt.copy(h, o); o += SALT_LEN;
  iv.copy(h, o); o += IV_LEN;
  h.writeUInt32LE(ARGON2_PARAMS.memoryCost, o); o += 4;
  h.writeUInt8(ARGON2_PARAMS.timeCost, o); o += 1;
  h.writeUInt8(ARGON2_PARAMS.parallelism, o); o += 1;
  o += 8;
  h.writeUInt16LE(fnBuf.length, o); o += 2;
  fnBuf.copy(h, o); o += fnBuf.length;
  h.writeBigUInt64LE(BigInt(size), o);
  return h;
}

export async function readHeader(filePath: string): Promise<Header> {
  const chunks: Uint8Array[] = [];
  const stream = fs.createReadStream(filePath, { start: 0, end: HDR_LEN - 1 });
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const buf = Buffer.concat(chunks);
  if (buf.length < HDR_LEN || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Invalid encrypted file');
  }
  let o = MAGIC.length + 1 + SALT_LEN + IV_LEN + 4 + 1 + 1 + 8;
  const fnLen = buf.readUInt16LE(o); o += 2;
  const fn = buf.subarray(o, o + fnLen).toString('utf-8'); o += fnLen;
  const size = Number(buf.readBigUInt64LE(o));
  return {
    salt: buf.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN),
    iv: buf.subarray(MAGIC.length + 1 + SALT_LEN, MAGIC.length + 1 + SALT_LEN + IV_LEN),
    filename: fn,
    originalSize: size,
  };
}

export interface Progress {
  bytes: number;
  total: number;
  pct: number;
}

export async function encryptFile(inputPath: string, masterKey: Buffer, onProgress?: (p: Progress) => void): Promise<string> {
  const stat = fs.statSync(inputPath);
  const salt = genSalt();
  const iv = genIv();
  const key = await deriveKey(masterKey.toString('base64'), salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN });

  const tmpPath = inputPath + '.encrypting';
  const hdr = buildHeader(salt, iv, path.basename(inputPath), stat.size);
  fs.writeFileSync(tmpPath, hdr);

  const rs = fs.createReadStream(inputPath, { highWaterMark: BUF_SIZE });
  const ws = fs.createWriteStream(tmpPath, { flags: 'a' });

  let done = 0;
  rs.on('data', (c: Buffer) => {
    done += c.length;
    if (onProgress) onProgress({ bytes: done, total: stat.size, pct: Math.round((done / stat.size) * 100) });
  });

  await pipeline(rs, cipher, ws);
  fs.appendFileSync(tmpPath, cipher.getAuthTag());

  secureClear(key);
  cipher.destroy();

  fs.unlinkSync(inputPath);
  const outPath = inputPath + EXT;
  fs.renameSync(tmpPath, outPath);
  return outPath;
}

export async function decryptFile(inputPath: string, masterKey: Buffer, onProgress?: (p: Progress) => void): Promise<string> {
  const hdr = await readHeader(inputPath);
  const stat = fs.statSync(inputPath);
  const cipherSize = stat.size - HDR_LEN - TAG_LEN;

  if (cipherSize < 0) throw new Error('Corrupted file');

  const key = await deriveKey(masterKey.toString('base64'), hdr.salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, hdr.iv, { authTagLength: TAG_LEN });

  const tagStart = HDR_LEN + cipherSize;
  const tagChunks: Uint8Array[] = [];
  const tagStream = fs.createReadStream(inputPath, { start: tagStart, end: stat.size - 1 });
  await new Promise<void>((resolve, reject) => {
    tagStream.on('data', (c: Buffer) => tagChunks.push(c));
    tagStream.on('end', () => resolve());
    tagStream.on('error', reject);
  });
  const tag = Buffer.concat(tagChunks);
  if (tag.length !== TAG_LEN) throw new Error('Invalid auth tag');
  decipher.setAuthTag(tag);

  const outName = hdr.filename || path.basename(inputPath).slice(0, -EXT.length);
  const outPath = path.join(path.dirname(inputPath), outName);
  const tmpPath = outPath + '.decrypting';

  if (cipherSize === 0) {
    const final = Buffer.concat([decipher.update(Buffer.alloc(0)), decipher.final()]);
    fs.writeFileSync(tmpPath, final);
  } else {
    const rs = fs.createReadStream(inputPath, { start: HDR_LEN, end: HDR_LEN + cipherSize - 1, highWaterMark: BUF_SIZE });
    const ws = fs.createWriteStream(tmpPath);
    let done = 0;
    rs.on('data', (c: Buffer) => {
      done += c.length;
      if (onProgress) onProgress({ bytes: done, total: cipherSize, pct: Math.round((done / cipherSize) * 100) });
    });
    await pipeline(rs, decipher, ws);
  }

  secureClear(key);
  decipher.destroy();

  fs.unlinkSync(inputPath);
  fs.renameSync(tmpPath, outPath);
  return outPath;
}
