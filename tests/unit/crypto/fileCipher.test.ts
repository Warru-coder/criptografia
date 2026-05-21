import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptFile } from '../../../src/crypto/fileCipher';
import { decryptFile } from '../../../src/crypto/fileDecipher';
import { deriveKey } from '../../../src/crypto/cryptoUtils';

const testDir = path.join(os.tmpdir(), 'securecrypt-test-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('fileCipher', () => {
  it('should encrypt and decrypt a file successfully', async () => {
    const originalContent = 'This is a test file content for encryption.';
    const inputPath = path.join(testDir, 'test.txt');
    const encryptedPath = path.join(testDir, 'test.txt.scrypt');
    const decryptedPath = path.join(testDir, 'test_decrypted.txt');

    fs.writeFileSync(inputPath, originalContent, 'utf-8');

    const masterKey = crypto.randomBytes(32);

    await encryptFile(inputPath, encryptedPath, masterKey);

    expect(fs.existsSync(encryptedPath)).toBe(true);

    await decryptFile(encryptedPath, decryptedPath, masterKey);

    const decryptedContent = fs.readFileSync(decryptedPath, 'utf-8');
    expect(decryptedContent).toBe(originalContent);
  });

  it('should produce different ciphertext for same input', async () => {
    const originalContent = 'Same content';
    const inputPath = path.join(testDir, 'test2.txt');
    const encryptedPath1 = path.join(testDir, 'test2.txt.scrypt1');
    const encryptedPath2 = path.join(testDir, 'test2.txt.scrypt2');

    fs.writeFileSync(inputPath, originalContent, 'utf-8');

    const masterKey = crypto.randomBytes(32);

    await encryptFile(inputPath, encryptedPath1, masterKey);
    await encryptFile(inputPath, encryptedPath2, masterKey);

    const cipher1 = fs.readFileSync(encryptedPath1);
    const cipher2 = fs.readFileSync(encryptedPath2);

    expect(cipher1.equals(cipher2)).toBe(false);
  });

  it('should fail decryption with wrong key', async () => {
    const originalContent = 'Secret data';
    const inputPath = path.join(testDir, 'test3.txt');
    const encryptedPath = path.join(testDir, 'test3.txt.scrypt');
    const decryptedPath = path.join(testDir, 'test3_decrypted.txt');

    fs.writeFileSync(inputPath, originalContent, 'utf-8');

    const correctKey = crypto.randomBytes(32);
    const wrongKey = crypto.randomBytes(32);

    await encryptFile(inputPath, encryptedPath, correctKey);

    await expect(decryptFile(encryptedPath, decryptedPath, wrongKey)).rejects.toThrow();
  });

  it('should handle binary files', async () => {
    const originalContent = crypto.randomBytes(1024);
    const inputPath = path.join(testDir, 'test.bin');
    const encryptedPath = path.join(testDir, 'test.bin.scrypt');
    const decryptedPath = path.join(testDir, 'test_decrypted.bin');

    fs.writeFileSync(inputPath, originalContent);

    const masterKey = crypto.randomBytes(32);

    await encryptFile(inputPath, encryptedPath, masterKey);
    await decryptFile(encryptedPath, decryptedPath, masterKey);

    const decryptedContent = fs.readFileSync(decryptedPath);
    expect(decryptedContent.equals(originalContent)).toBe(true);
  });

  it('should encrypt and decrypt an empty file', async () => {
    const inputPath = path.join(testDir, 'empty.txt');
    const encryptedPath = path.join(testDir, 'empty.txt.scrypt');
    const decryptedPath = path.join(testDir, 'empty_decrypted.txt');

    fs.writeFileSync(inputPath, Buffer.alloc(0));

    const masterKey = crypto.randomBytes(32);
    const progressUpdates: number[] = [];

    await encryptFile(inputPath, encryptedPath, masterKey);
    const result = await decryptFile(encryptedPath, decryptedPath, masterKey, (progress) => {
      progressUpdates.push(progress.percentage);
    });

    const decryptedContent = fs.readFileSync(decryptedPath);
    expect(decryptedContent.length).toBe(0);
    expect(result.originalSize).toBe(0);
    expect(progressUpdates).toEqual([100]);
  });
});
