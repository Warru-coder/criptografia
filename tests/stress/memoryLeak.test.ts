import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptFile } from '../../src/crypto/fileCipher';
import { decryptFile } from '../../src/crypto/fileDecipher';

const testDir = path.join(os.tmpdir(), 'securecrypt-memory-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Memory Management', () => {
  it('should not leak memory after multiple encrypt/decrypt cycles', async () => {
    const masterKey = crypto.randomBytes(32);
    const cycles = 10;
    const content = crypto.randomBytes(1024 * 100);

    const initialMemory = process.memoryUsage();

    for (let i = 0; i < cycles; i++) {
      const inputPath = path.join(testDir, `cycle_${i}.bin`);
      const encryptedPath = path.join(testDir, `cycle_${i}.bin.scrypt`);
      const decryptedPath = path.join(testDir, `cycle_${i}_decrypted.bin`);

      fs.writeFileSync(inputPath, content);

      await encryptFile(inputPath, encryptedPath, masterKey);
      await decryptFile(encryptedPath, decryptedPath, masterKey);

      const decrypted = fs.readFileSync(decryptedPath);
      expect(decrypted.equals(content)).toBe(true);

      fs.unlinkSync(inputPath);
      fs.unlinkSync(encryptedPath);
      fs.unlinkSync(decryptedPath);
    }

    const finalMemory = process.memoryUsage();
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

    expect(heapGrowth).toBeLessThan(50 * 1024 * 1024);
  });

  it('should handle repeated key derivation without memory growth', async () => {
    const { deriveKey, generateSalt } = await import('../../src/crypto/cryptoUtils');
    const iterations = 20;

    const initialMemory = process.memoryUsage();

    for (let i = 0; i < iterations; i++) {
      const salt = generateSalt();
      await deriveKey('TestPassword123!', salt);
    }

    const finalMemory = process.memoryUsage();
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

    expect(heapGrowth).toBeLessThan(20 * 1024 * 1024);
  });
});
