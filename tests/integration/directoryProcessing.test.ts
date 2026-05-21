import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { encryptDirectory, decryptDirectory } from '../../src/filesystem/directoryProcessor';
import { ENCRYPTED_EXTENSION } from '../../src/core/constants';

const testDir = path.join(os.tmpdir(), 'securecrypt-dir-test-' + Date.now());
const inputDir = path.join(testDir, 'input');
const encryptedDir = path.join(testDir, 'encrypted');
const decryptedDir = path.join(testDir, 'decrypted');

beforeAll(() => {
  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(path.join(inputDir, 'subdir'), { recursive: true });

  fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'Hello from file 1', 'utf-8');
  fs.writeFileSync(path.join(inputDir, 'file2.bin'), crypto.randomBytes(512));
  fs.writeFileSync(path.join(inputDir, 'subdir', 'file3.txt'), 'Nested file content', 'utf-8');
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Directory Processing', () => {
  it('should encrypt all files in a directory', async () => {
    const masterKey = crypto.randomBytes(32);

    const result = await encryptDirectory(inputDir, encryptedDir, masterKey);

    expect(result.processedFiles).toBe(3);
    expect(result.failedFiles).toBe(0);
    expect(fs.existsSync(path.join(encryptedDir, 'file1.txt' + ENCRYPTED_EXTENSION))).toBe(true);
    expect(fs.existsSync(path.join(encryptedDir, 'file2.bin' + ENCRYPTED_EXTENSION))).toBe(true);
    expect(fs.existsSync(path.join(encryptedDir, 'subdir', 'file3.txt' + ENCRYPTED_EXTENSION))).toBe(true);
  });

  it('should decrypt all files in a directory', async () => {
    const masterKey = crypto.randomBytes(32);

    await encryptDirectory(inputDir, encryptedDir, masterKey);
    const result = await decryptDirectory(encryptedDir, decryptedDir, masterKey);

    expect(result.processedFiles).toBe(3);
    expect(result.failedFiles).toBe(0);

    const original1 = fs.readFileSync(path.join(inputDir, 'file1.txt'), 'utf-8');
    const decrypted1 = fs.readFileSync(path.join(decryptedDir, 'file1.txt'), 'utf-8');
    expect(decrypted1).toBe(original1);

    const original3 = fs.readFileSync(path.join(inputDir, 'subdir', 'file3.txt'), 'utf-8');
    const decrypted3 = fs.readFileSync(path.join(decryptedDir, 'subdir', 'file3.txt'), 'utf-8');
    expect(decrypted3).toBe(original3);

    const original2 = fs.readFileSync(path.join(inputDir, 'file2.bin'));
    const decrypted2 = fs.readFileSync(path.join(decryptedDir, 'file2.bin'));
    expect(decrypted2.equals(original2)).toBe(true);
  });

  it('should report progress during directory encryption', async () => {
    const masterKey = crypto.randomBytes(32);
    const progressUpdates: number[] = [];

    await encryptDirectory(inputDir, path.join(testDir, 'encrypted2'), masterKey, (progress) => {
      progressUpdates.push(progress.overallPercentage);
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });
});
