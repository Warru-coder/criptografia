import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordStrength } from '../../../src/passwordManager/passwordValidator';

describe('passwordValidator', () => {
  it('should reject short passwords', () => {
    const result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('lowercase123!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
  });

  it('should reject passwords without lowercase', () => {
    const result = validatePassword('UPPERCASE123!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('lowercase'))).toBe(true);
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbersHere!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('number'))).toBe(true);
  });

  it('should reject passwords without special characters', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('special'))).toBe(true);
  });

  it('should accept strong passwords', () => {
    const result = validatePassword('Str0ng!Pass');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject common passwords', () => {
    const result = validatePassword('password');
    expect(result.isValid).toBe(false);
  });

  it('should return correct strength score', () => {
    const weak = validatePassword('Weak1!aa');
    const strong = validatePassword('V3ry!Str0ng#Pass');

    expect(weak.score).toBeLessThan(strong.score);
  });

  it('should return strength labels', () => {
    expect(getPasswordStrength(1)).toBe('Weak');
    expect(getPasswordStrength(3)).toBe('Moderate');
    expect(getPasswordStrength(5)).toBe('Strong');
    expect(getPasswordStrength(7)).toBe('Very Strong');
  });
});
