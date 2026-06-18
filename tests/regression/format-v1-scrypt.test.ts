import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptFile } from '../../src/crypto/fileCipher';
import { decryptFile } from '../../src/crypto/fileDecipher';
import { readHeader } from '../../src/filesystem/fileMetadata';
import {
  MAGIC_BYTES,
  FILE_VERSION,
  SALT_LENGTH,
  IV_LENGTH,
  HEADER_SIZE,
  AUTH_TAG_LENGTH,
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
} from '../../src/core/constants';

/**
 * Golden test del formato `.scrypt` v1 (pre-auditoría, tag pre-audit-v0.3.0).
 *
 * Propósito: congelar el formato actual antes de las Fases 1-2.
 * Si este test falla en una rama de remediación, significa que se ha roto
 * compatibilidad con archivos cifrados por usuarios v0.3.0. Acciones:
 *   1) Restaurar compatibilidad, o
 *   2) Documentar la rotura con un ADR + plan de migración para usuarios.
 *
 * NUNCA ajustar este test para que pase de nuevo sin entender el cambio.
 */

const GOLDEN_PLAINTEXT = Buffer.from('SecureCrypt golden vector v1\n', 'utf-8');
const GOLDEN_MASTER_KEY = Buffer.from(
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  'hex',
); // 32 bytes deterministas

const testDir = path.join(os.tmpdir(), 'securecrypt-golden-v1-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Golden v1: formato .scrypt (pre-auditoría)', () => {
  it('cabecera respeta el layout v1 documentado', async () => {
    const input = path.join(testDir, 'golden.txt');
    const encrypted = path.join(testDir, 'golden.txt.scrypt');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);

    const fd = fs.openSync(encrypted, 'r');
    const buf = Buffer.alloc(HEADER_SIZE);
    fs.readSync(fd, buf, 0, HEADER_SIZE, 0);
    fs.closeSync(fd);

    // MAGIC en bytes 0..5
    expect(buf.subarray(0, MAGIC_BYTES.length).equals(MAGIC_BYTES)).toBe(true);

    // VERSION en byte 6
    expect(buf.readUInt8(MAGIC_BYTES.length)).toBe(FILE_VERSION);

    // Argon2 params en su offset esperado
    const paramsOffset = MAGIC_BYTES.length + 1 + SALT_LENGTH + IV_LENGTH;
    expect(buf.readUInt32LE(paramsOffset)).toBe(ARGON2_MEMORY_COST);
    expect(buf.readUInt8(paramsOffset + 4)).toBe(ARGON2_TIME_COST);
    expect(buf.readUInt8(paramsOffset + 5)).toBe(ARGON2_PARALLELISM);

    // Salt e IV no son todo ceros (aleatorios)
    const salt = buf.subarray(MAGIC_BYTES.length + 1, MAGIC_BYTES.length + 1 + SALT_LENGTH);
    const iv = buf.subarray(
      MAGIC_BYTES.length + 1 + SALT_LENGTH,
      MAGIC_BYTES.length + 1 + SALT_LENGTH + IV_LENGTH,
    );
    expect(salt.equals(Buffer.alloc(SALT_LENGTH, 0))).toBe(false);
    expect(iv.equals(Buffer.alloc(IV_LENGTH, 0))).toBe(false);
  });

  it('readHeader devuelve los campos esperados', async () => {
    const input = path.join(testDir, 'golden2.txt');
    const encrypted = path.join(testDir, 'golden2.txt.scrypt');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);
    const header = await readHeader(encrypted);

    expect(header.version).toBe(FILE_VERSION);
    expect(header.salt.length).toBe(SALT_LENGTH);
    expect(header.iv.length).toBe(IV_LENGTH);
    expect(header.argon2MemoryCost).toBe(ARGON2_MEMORY_COST);
    expect(header.argon2TimeCost).toBe(ARGON2_TIME_COST);
    expect(header.argon2Parallelism).toBe(ARGON2_PARALLELISM);
    expect(header.originalSize).toBe(GOLDEN_PLAINTEXT.length);
    expect(header.originalFilename).toBe('golden2.txt');
  });

  it('tamaño total = HEADER_SIZE + plaintext + AUTH_TAG_LENGTH', async () => {
    const input = path.join(testDir, 'sized.txt');
    const encrypted = path.join(testDir, 'sized.txt.scrypt');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);
    const size = fs.statSync(encrypted).size;
    expect(size).toBe(HEADER_SIZE + GOLDEN_PLAINTEXT.length + AUTH_TAG_LENGTH);
  });

  it('descifra correctamente con la misma masterKey', async () => {
    const input = path.join(testDir, 'rt.txt');
    const encrypted = path.join(testDir, 'rt.txt.scrypt');
    const decrypted = path.join(testDir, 'rt.dec');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);
    await decryptFile(encrypted, decrypted, GOLDEN_MASTER_KEY);

    expect(fs.readFileSync(decrypted).equals(GOLDEN_PLAINTEXT)).toBe(true);
  });

  it('rechaza descifrado con masterKey incorrecta (auth tag falla)', async () => {
    const input = path.join(testDir, 'wrong.txt');
    const encrypted = path.join(testDir, 'wrong.txt.scrypt');
    const decrypted = path.join(testDir, 'wrong.dec');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);

    const wrongKey = crypto.randomBytes(32);
    await expect(decryptFile(encrypted, decrypted, wrongKey)).rejects.toThrow();
  });

  it('rechaza descifrado si se modifica 1 byte del ciphertext', async () => {
    const input = path.join(testDir, 'tamper.txt');
    const encrypted = path.join(testDir, 'tamper.txt.scrypt');
    const decrypted = path.join(testDir, 'tamper.dec');
    fs.writeFileSync(input, GOLDEN_PLAINTEXT);

    await encryptFile(input, encrypted, GOLDEN_MASTER_KEY);

    // Flip 1 bit en mitad del ciphertext
    const buf = fs.readFileSync(encrypted);
    const tamperOffset = HEADER_SIZE + Math.floor(GOLDEN_PLAINTEXT.length / 2);
    buf[tamperOffset] ^= 0x01;
    fs.writeFileSync(encrypted, buf);

    await expect(decryptFile(encrypted, decrypted, GOLDEN_MASTER_KEY)).rejects.toThrow();
  });
});
