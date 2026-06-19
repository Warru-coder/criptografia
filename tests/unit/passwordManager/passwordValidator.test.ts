import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordStrength } from '../../../src/passwordManager/passwordValidator';

// ALTA-08 / ADR-0011: NIST SP 800-63B password policy tests.

describe('passwordValidator (NIST 800-63B)', () => {
  it('rejects passwords shorter than 12 chars', () => {
    const r = validatePassword('Short1!aaa');  // 10 chars
    expect(r.isValid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/12 characters/);
  });

  it('accepts a long passphrase with no composition rules', () => {
    const r = validatePassword('correct horse battery staple');
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('does NOT require uppercase / lowercase / digit / special', () => {
    const r = validatePassword('the brown fox jumps');  // 19 lowercase + spaces
    expect(r.isValid).toBe(true);
  });

  it('rejects blocked-list common passwords', () => {
    expect(validatePassword('password123').isValid).toBe(false);
    expect(validatePassword('qwertyuiop').isValid).toBe(false);
    expect(validatePassword('letmeinplease').isValid).toBe(true); // not on list, long enough
  });

  it('rejects 4+ identical characters in a row', () => {
    const r = validatePassword('aaaa12345xyz!');
    expect(r.isValid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/identical characters/);
  });

  it('rejects long sequential runs (12345, qwerty)', () => {
    expect(validatePassword('zx 123456 zxcv').isValid).toBe(false);
    expect(validatePassword('a qwerty x12345').isValid).toBe(false);
  });

  it('higher entropy → higher score', () => {
    const low = validatePassword('aaaaabbbbbccc');  // repeated, blocked → low
    const high = validatePassword('Jp9-x!K2qTm#Z4');
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('strength labels map as expected', () => {
    expect(getPasswordStrength(1)).toBe('Weak');
    expect(getPasswordStrength(3)).toBe('Moderate');
    expect(getPasswordStrength(5)).toBe('Strong');
    expect(getPasswordStrength(7)).toBe('Very Strong');
  });
});
