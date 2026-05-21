---
name: securecrypt-crypto
description: Use when working with cryptographic operations in SecureCrypt — AES-256-GCM encryption/decryption, Argon2id key derivation, IV/salt generation, integrity verification, or any file in src/crypto/. Use ONLY when modifying crypto code, not for general application logic.
---

# SecureCrypt Cryptographic Guidelines

## Core Principles

### NEVER
- Reuse IV or salt across encryption operations
- Store passwords in plaintext — only Argon2id hashes
- Load entire files into memory for encryption — always use streaming
- Swallow crypto errors — always propagate with context
- Forget to clear sensitive buffers after use (`Buffer.fill(0)`)

### ALWAYS
- Generate fresh `crypto.randomBytes(16)` for each IV and salt
- Use AES-256-GCM (never ECB, CBC, or CTR without authentication)
- Verify auth tag after decryption — GCM will throw on tampering
- Use Argon2id with: memoryCost=65536, timeCost=3, parallelism=2
- Write metadata after encryption, before deleting originals

## File Structure

```
src/crypto/
├── cryptoUtils.ts       # salt/IV generation, password verification, secureClear
├── keyDerivation.ts     # Argon2id key derivation for files and master key
├── fileCipher.ts        # AES-256-GCM encryption via streaming
└── fileDecipher.ts      # AES-256-GCM decryption with auth tag verification
```

## Encryption Flow

1. Generate unique salt + IV via `crypto.randomBytes(16)`
2. Derive file-specific key via Argon2id(password, salt)
3. Create `crypto.createCipheriv('aes-256-gcm', key, iv)`
4. Write 128-byte header (magic, version, salt, IV, filename, size)
5. Stream file through cipher pipeline
6. Append 16-byte GCM auth tag at end
7. Write metadata JSON to AppSecureData/metadata/
8. `secureClear(fileKey)` — zero out key buffer

## Decryption Flow

1. Read and validate 128-byte header (check magic bytes)
2. Extract salt + IV from header
3. Derive same key via Argon2id(password, salt)
4. Read last 16 bytes as auth tag
5. Create decipher, set auth tag
6. Stream ciphertext through decipher pipeline
7. GCM automatically verifies integrity — throws if tampered
8. `secureClear(fileKey)`

## Header Format (128 bytes)

| Offset | Size | Field |
|---|---|---|
| 0 | 6 | Magic "SCRYPT" |
| 6 | 1 | Version (1) |
| 7 | 16 | Salt |
| 23 | 16 | IV |
| 39 | 4 | Argon2 memoryCost (LE) |
| 43 | 1 | Argon2 timeCost |
| 44 | 1 | Argon2 parallelism |
| 45 | 8 | Reserved |
| 53 | 2 | Filename length (LE) |
| 55 | var | Original filename (UTF-8) |
| var | 8 | Original size (LE, 64-bit) |

## Error Classes

- `CryptoError` — cipher failures, invalid headers, auth tag mismatch
- `PasswordError` — wrong password, vault not initialized
- `FileError` — file not found, permission denied

## Testing

All crypto changes require:
- Unit tests for key derivation consistency
- Unit tests for unique ciphertext per operation
- Integration test for full encrypt/decrypt cycle
- Test for wrong-key rejection
- Test for binary file handling
