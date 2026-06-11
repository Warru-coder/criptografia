
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    errors.push('Password must contain at least one number');
  }

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score += 2;
  } else {
    errors.push('Password must contain at least one special character');
  }

  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password must not contain repeated characters');
    score -= 1;
  }

  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'letmein'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
    score -= 2;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.max(0, Math.min(7, score)),
  };
}

export function getPasswordStrength(score: number): string {
  if (score <= 2) return 'Weak';
  if (score <= 4) return 'Moderate';
  if (score <= 5) return 'Strong';
  return 'Very Strong';
}
