import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptFile } from '../../src/crypto/fileCipher';
import { decryptFile } from '../../src/crypto/fileDecipher';
import { readHeader } from '../../src/filesystem/fileMetadata';
import { MAGIC_BYTES, ENCRYPTED_EXTENSION, HEADER_SIZE, AUTH_TAG_LENGTH } from '../../src/core/constants';

const testDir = path.join(os.tmpdir(), 'securecrypt-integration-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Full Encrypt/Decrypt Cycle', () => {
  it('should complete full cycle with text file', async () => {
    const original = 'Hello, SecureCrypt! This is an integration test.';
    const inputPath = path.join(testDir, 'integration.txt');
    const encryptedPath = path.join(testDir, 'integration.txt' + ENCRYPTED_EXTENSION);
    const decryptedPath = path.join(testDir, 'integration_decrypted.txt');

    fs.writeFileSync(inputPath, original, 'utf-8');

    const masterKey = crypto.randomBytes(32);

    const encryptResult = await encryptFile(inputPath, encryptedPath, masterKey);

    expect(encryptResult.originalSize).toBe(original.length);
    expect(fs.existsSync(encryptedPath)).toBe(true);

    const header = readHeader(encryptedPath);
    expect(header.magic.equals(MAGIC_BYTES)).toBe(true);
    expect(header.originalFilename).toBe('integration.txt');
    expect(header.originalSize).toBe(original.length);

    const decryptResult = await decryptFile(encryptedPath, decryptedPath, masterKey);

    const decrypted = fs.readFileSync(decryptedPath, 'utf-8');
    expect(decrypted).toBe(original);
    expect(decryptResult.originalSize).toBe(original.length);
  });

  it('should complete full cycle with large file', async () => {
    const largeContent = crypto.randomBytes(1024 * 1024);
    const inputPath = path.join(testDir, 'large.bin');
    const encryptedPath = path.join(testDir, 'large.bin' + ENCRYPTED_EXTENSION);
    const decryptedPath = path.join(testDir, 'large_decrypted.bin');

    fs.writeFileSync(inputPath, largeContent);

    const masterKey = crypto.randomBytes(32);

    await encryptFile(inputPath, encryptedPath, masterKey);

    const encryptedSize = fs.statSync(encryptedPath).size;
    expect(encryptedSize).toBeGreaterThan(largeContent.length + HEADER_SIZE);

    await decryptFile(encryptedPath, decryptedPath, masterKey);

    const decrypted = fs.readFileSync(decryptedPath);
    expect(decrypted.equals(largeContent)).toBe(true);
  });

  it('should verify encrypted file structure', async () => {
    const content = 'Structure test';
    const inputPath = path.join(testDir, 'structure.txt');
    const encryptedPath = path.join(testDir, 'structure.txt' + ENCRYPTED_EXTENSION);

    fs.writeFileSync(inputPath, content, 'utf-8');

    const masterKey = crypto.randomBytes(32);
    await encryptFile(inputPath, encryptedPath, masterKey);

    const fileBuffer = fs.readFileSync(encryptedPath);
    const fileSize = fileBuffer.length;

    expect(fileBuffer.subarray(0, MAGIC_BYTES.length).equals(MAGIC_BYTES)).toBe(true);
    expect(fileSize).toBeGreaterThan(HEADER_SIZE + AUTH_TAG_LENGTH);

    const authTag = fileBuffer.subarray(fileSize - AUTH_TAG_LENGTH);
    expect(authTag.length).toBe(AUTH_TAG_LENGTH);
  });
});
