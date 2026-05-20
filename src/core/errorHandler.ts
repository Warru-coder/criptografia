export class SecureCryptError extends Error {
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SecureCryptError';
    this.code = code;
  }
}

export class CryptoError extends SecureCryptError {
  constructor(message: string) {
    super(message, 'CRYPTO_ERROR');
    this.name = 'CryptoError';
  }
}

export class PasswordError extends SecureCryptError {
  constructor(message: string) {
    super(message, 'PASSWORD_ERROR');
    this.name = 'PasswordError';
  }
}

export class FileError extends SecureCryptError {
  constructor(message: string) {
    super(message, 'FILE_ERROR');
    this.name = 'FileError';
  }
}

export class ValidationError extends SecureCryptError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
