import { describe, it, expect } from 'vitest';
import { deriveKey, deriveKeyForStorage, verifyPassword, generateSalt, generateIv, secureClear } from '../../../src/crypto/cryptoUtils';

describe('cryptoUtils', () => {
  it('should generate unique salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1.equals(salt2)).toBe(false);
  });

  it('should generate unique IVs', () => {
    const iv1 = generateIv();
    const iv2 = generateIv();
    expect(iv1.equals(iv2)).toBe(false);
  });

  it('should generate salt of correct length', () => {
    const salt = generateSalt();
    expect(salt.length).toBe(16);
  });

  it('should generate IV of correct length', () => {
    const iv = generateIv();
    expect(iv.length).toBe(16);
  });

  it('should derive consistent key with same inputs', async () => {
    const password = 'TestPassword123!';
    const salt = Buffer.alloc(16, 0xaa);
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey(password, salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it('should derive different keys with different salts', async () => {
    const password = 'TestPassword123!';
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = await deriveKey(password, salt1);
    const key2 = await deriveKey(password, salt2);
    expect(key1.equals(key2)).toBe(false);
  });

  it('should verify password correctly', async () => {
    const password = 'SecurePass123!';
    const { hash } = await deriveKeyForStorage(password);
    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const password = 'SecurePass123!';
    const { hash } = await deriveKeyForStorage(password);
    const isValid = await verifyPassword(hash, 'WrongPassword456!');
    expect(isValid).toBe(false);
  });

  it('should clear buffer securely', () => {
    const buffer = Buffer.from('sensitive data');
    secureClear(buffer);
    expect(buffer.every((b) => b === 0)).toBe(true);
  });
});
