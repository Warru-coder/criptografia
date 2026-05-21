import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptFile } from '../../src/crypto/fileCipher';
import { decryptFile } from '../../src/crypto/fileDecipher';

const testDir = path.join(os.tmpdir(), 'securecrypt-stress-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Stress Tests', () => {
  it('should handle 20 concurrent file encryptions', async () => {
    const masterKey = crypto.randomBytes(32);
    const fileCount = 20;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < fileCount; i++) {
      const content = crypto.randomBytes(1024 * 10);
      const inputPath = path.join(testDir, `stress_${i}.bin`);
      const encryptedPath = path.join(testDir, `stress_${i}.bin.scrypt`);
      const decryptedPath = path.join(testDir, `stress_${i}_decrypted.bin`);

      fs.writeFileSync(inputPath, content);

      promises.push(
        (async () => {
          await encryptFile(inputPath, encryptedPath, masterKey);
          await decryptFile(encryptedPath, decryptedPath, masterKey);
          const original = fs.readFileSync(inputPath);
          const decrypted = fs.readFileSync(decryptedPath);
          expect(decrypted.equals(original)).toBe(true);
        })()
      );
    }

    const results = await Promise.allSettled(promises);
    const failed = results.filter((r) => r.status === 'rejected');
    expect(failed).toHaveLength(0);
  });

  it('should handle large file (5MB) without memory issues', async () => {
    const masterKey = crypto.randomBytes(32);
    const largeContent = crypto.randomBytes(5 * 1024 * 1024);
    const inputPath = path.join(testDir, 'large_stress.bin');
    const encryptedPath = path.join(testDir, 'large_stress.bin.scrypt');
    const decryptedPath = path.join(testDir, 'large_stress_decrypted.bin');

    fs.writeFileSync(inputPath, largeContent);

    const initialMemory = process.memoryUsage().heapUsed;

    await encryptFile(inputPath, encryptedPath, masterKey);
    await decryptFile(encryptedPath, decryptedPath, masterKey);

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    const decrypted = fs.readFileSync(decryptedPath);
    expect(decrypted.equals(largeContent)).toBe(true);

    expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
  });

  it('should handle many small files efficiently', async () => {
    const masterKey = crypto.randomBytes(32);
    const fileCount = 20;
    const startTime = Date.now();

    for (let i = 0; i < fileCount; i++) {
      const content = `Small file ${i} content`;
      const inputPath = path.join(testDir, `small_${i}.txt`);
      const encryptedPath = path.join(testDir, `small_${i}.txt.scrypt`);
      const decryptedPath = path.join(testDir, `small_${i}_decrypted.txt`);

      fs.writeFileSync(inputPath, content, 'utf-8');

      await encryptFile(inputPath, encryptedPath, masterKey);
      await decryptFile(encryptedPath, decryptedPath, masterKey);

      const decrypted = fs.readFileSync(decryptedPath, 'utf-8');
      expect(decrypted).toBe(content);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(120000);
  }, { timeout: 120000 });
});
