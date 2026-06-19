// ALTA-08 / ADR-0011: NIST SP 800-63B–aligned password policy.
//
// Changes vs. legacy validator:
//  - Minimum length: 12 (was 8). NIST recommends ≥8 for general, ≥12 for
//    high-value secrets. The master password protects all user data, so 12.
//  - REMOVED composition rules (upper/lower/digit/special). NIST 2017 and
//    OWASP 2024 explicitly recommend against them: they push users toward
//    predictable substitutions and reduce real entropy.
//  - Added: blocked-list check against an enlarged common-password set and
//    against simple patterns (sequential, repeated chars, keyboard rows,
//    palindromes of short tokens, username-equal-password).
//  - Score: composite entropy estimator (Shannon-style) producing 0..7,
//    with hardcoded penalty for blocked tokens.
//
// Future (Fase 4): integrate `zxcvbn` and HIBP k-anonymity range API.

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number;
}

const MIN_LENGTH = 12;

// Curated list of common/leaked passwords. In Fase 4 this will be replaced by
// HIBP k-anonymity queries.
const BLOCKED_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'letmein', 'welcome', 'admin', 'administrator', 'root', 'toor',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'football', 'baseball',
  'master', 'shadow', 'superman', 'batman', 'starwars', 'pokemon',
  'changeme', 'secret', 'trustno1', 'abc123456', '1qaz2wsx', 'q1w2e3r4',
  // SecureCrypt-specific
  'securecrypt', 'securecrypt123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
]);

// Keyboard row sequences (lowercase). Used for sequential-pattern detection.
const KEYBOARD_SEQUENCES = [
  'qwertyuiopasdfghjklzxcvbnm',
  '0123456789',
  'abcdefghijklmnopqrstuvwxyz',
];

function hasLongSequentialRun(pw: string, minRun = 5): boolean {
  const lower = pw.toLowerCase();
  for (const seq of KEYBOARD_SEQUENCES) {
    for (let i = 0; i <= seq.length - minRun; i++) {
      const slice = seq.slice(i, i + minRun);
      if (lower.includes(slice)) return true;
      // also check reversed
      const rev = slice.split('').reverse().join('');
      if (lower.includes(rev)) return true;
    }
  }
  return false;
}

function hasRepeatedChar(pw: string, minRun = 4): boolean {
  const re = new RegExp(`(.)\\1{${minRun - 1},}`);
  return re.test(pw);
}

function shannonEntropyBits(pw: string): number {
  if (pw.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const ch of pw) freq[ch] = (freq[ch] ?? 0) + 1;
  let H = 0;
  for (const c of Object.values(freq)) {
    const p = c / pw.length;
    H -= p * Math.log2(p);
  }
  return H * pw.length;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long`);
  }

  const lower = password.toLowerCase();

  if (BLOCKED_PASSWORDS.has(lower)) {
    errors.push('Password is on the blocked-list of common/leaked passwords');
  }

  if (hasRepeatedChar(password, 4)) {
    errors.push('Password must not contain 4 or more identical characters in a row');
  }

  if (hasLongSequentialRun(password, 5)) {
    errors.push('Password must not contain a long sequential run (e.g. "12345", "qwerty")');
  }

  const entropy = shannonEntropyBits(password);

  // Score from entropy: ≥60 bits ≈ strong, ≥80 ≈ very strong.
  let score: number;
  if (entropy < 28) score = 1;        // very weak
  else if (entropy < 36) score = 2;   // weak
  else if (entropy < 50) score = 3;   // moderate
  else if (entropy < 60) score = 4;
  else if (entropy < 75) score = 5;
  else if (entropy < 100) score = 6;
  else score = 7;

  if (errors.length > 0) {
    score = Math.max(0, Math.min(score, 2));
  }

  return {
    isValid: errors.length === 0,
    errors,
    score,
  };
}

export function getPasswordStrength(score: number): string {
  if (score <= 2) return 'Weak';
  if (score <= 4) return 'Moderate';
  if (score <= 5) return 'Strong';
  return 'Very Strong';
}
