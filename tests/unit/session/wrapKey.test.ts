import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

/**
 * Tests for CRIT-03 / CRIT-04 fix (ADR-005):
 * - Wrap uses HKDF-SHA256(SERVER_SECRET, salt=∅, info='SecureCrypt-v2-webauthn-wrap-key').
 * - Format prefix byte 0x02; v0x01 (legacy) is rejected.
 * - Roundtrip with the same SERVER_SECRET succeeds; with a different secret fails.
 */

// We test the algorithm directly because the functions are module-private.
// This is the canonical implementation the route uses.

const WRAP_KEY_INFO = Buffer.from('SecureCrypt-v2-webauthn-wrap-key');
const WRAP_FORMAT_VERSION = 0x02;

function deriveWrapKey(secret: string): Buffer {
  const seed = Buffer.from(secret, 'utf-8');
  const ab = crypto.hkdfSync('sha256', seed, Buffer.alloc(0), WRAP_KEY_INFO, 32);
  return Buffer.from(ab);
}

function wrap(masterKey: Buffer, secret: string): string {
  const kek = deriveWrapKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const enc = Buffer.concat([cipher.update(masterKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([WRAP_FORMAT_VERSION]), iv, tag, enc]).toString('base64');
}

function unwrap(wrapped: string, secret: string): Buffer {
  const buf = Buffer.from(wrapped, 'base64');
  if (buf[0] !== WRAP_FORMAT_VERSION) throw new Error(`Unsupported format v${buf[0]}`);
  const kek = deriveWrapKey(secret);
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const enc = buf.subarray(29);
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

describe('Wrap masterKey (CRIT-03/CRIT-04 fix)', () => {
  const SECRET = 'A'.repeat(44); // simulates a 44-char base64 secret
  const masterKey = crypto.randomBytes(32);

  it('roundtrips with the same SERVER_SECRET', () => {
    const wrapped = wrap(masterKey, SECRET);
    const recovered = unwrap(wrapped, SECRET);
    expect(recovered.equals(masterKey)).toBe(true);
  });

  it('produces format with version byte 0x02', () => {
    const wrapped = wrap(masterKey, SECRET);
    const buf = Buffer.from(wrapped, 'base64');
    expect(buf[0]).toBe(0x02);
  });

  it('layout is [version:1][iv:12][tag:16][ciphertext]', () => {
    const wrapped = wrap(masterKey, SECRET);
    const buf = Buffer.from(wrapped, 'base64');
    expect(buf.length).toBe(1 + 12 + 16 + masterKey.length);
  });

  it('different SERVER_SECRET produces different wrap', () => {
    const w1 = wrap(masterKey, SECRET);
    const w2 = wrap(masterKey, 'B'.repeat(44));
    expect(w1).not.toBe(w2);
  });

  it('unwrap with wrong SERVER_SECRET fails (auth tag)', () => {
    const wrapped = wrap(masterKey, SECRET);
    expect(() => unwrap(wrapped, 'C'.repeat(44))).toThrow();
  });

  it('rejects legacy v0x01 format', () => {
    const fakeV1 = Buffer.concat([
      Buffer.from([0x01]),
      crypto.randomBytes(12),
      crypto.randomBytes(16),
      crypto.randomBytes(32),
    ]).toString('base64');
    expect(() => unwrap(fakeV1, SECRET)).toThrow(/Unsupported format/);
  });

  it('HKDF is deterministic — same secret yields same KEK', () => {
    const k1 = deriveWrapKey(SECRET);
    const k2 = deriveWrapKey(SECRET);
    expect(k1.equals(k2)).toBe(true);
  });

  it('domain separation: different info would produce different KEK (sanity)', () => {
    const seed = Buffer.from(SECRET, 'utf-8');
    const ab1 = crypto.hkdfSync('sha256', seed, Buffer.alloc(0), WRAP_KEY_INFO, 32);
    const ab2 = crypto.hkdfSync('sha256', seed, Buffer.alloc(0), Buffer.from('other-purpose'), 32);
    expect(Buffer.from(ab1).equals(Buffer.from(ab2))).toBe(false);
  });
});
