---
name: securecrypt-testing
description: Use when writing, modifying, or debugging tests for SecureCrypt. Covers unit tests, integration tests, stress tests, and cryptographic validation. Use ONLY when working with files in tests/ or adding test-related code.
---

# SecureCrypt Testing Guidelines

## Test Framework

- **Vitest** — configured in `vitest.config.ts`
- Run: `npm run test` (single run) or `npm run test:watch` (watch mode)
- Timeout: 30s per test (crypto operations can be slow due to Argon2id)

## Test Structure

```
tests/
├── unit/
│   ├── crypto/
│   │   ├── keyDerivation.test.ts    # salt/IV uniqueness, key consistency, password verify
│   │   └── fileCipher.test.ts       # encrypt/decrypt cycle, wrong key rejection, binary files
│   └── passwordManager/
│       └── passwordValidator.test.ts # password strength rules, common password rejection
└── integration/
    └── fullEncryptDecrypt.test.ts    # end-to-end encrypt/decrypt, large files, header structure
```

## Import Paths

Tests are in `tests/` subdirectories, so imports use relative paths:

```typescript
// From tests/unit/crypto/
import { encryptFile } from '../../../src/crypto/fileCipher';

// From tests/integration/
import { encryptFile } from '../../src/crypto/fileCipher';
```

## Writing Tests

### Unit Tests
- Test single functions in isolation
- Use `crypto.randomBytes(32)` for test keys (no password derivation needed)
- Keep tests fast — avoid Argon2id when testing non-derivation logic

### Integration Tests
- Test full encrypt → decrypt cycles
- Use `os.tmpdir()` for test files, clean up in `afterAll`
- Test with both text and binary content
- Verify file headers and metadata

### Test File Cleanup

```typescript
const testDir = path.join(os.tmpdir(), 'securecrypt-test-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
```

## What to Test

### Crypto Module
- [ ] Salt uniqueness (never repeat)
- [ ] IV uniqueness (never repeat)
- [ ] Key derivation consistency (same inputs → same key)
- [ ] Different keys for different salts
- [ ] Password verification (correct password passes, wrong fails)
- [ ] Buffer secure clearing (all zeros after secureClear)
- [ ] Encrypt/decrypt roundtrip (content matches)
- [ ] Different ciphertext for same input (unique IV/salt)
- [ ] Wrong key rejection (throws on decrypt)
- [ ] Binary file handling (no corruption)

### Password Manager
- [ ] Minimum length enforcement
- [ ] Character class requirements (upper, lower, number, special)
- [ ] Common password rejection
- [ ] Strength scoring
- [ ] Repeated character detection

### Integration
- [ ] Full encrypt/decrypt cycle with text files
- [ ] Full encrypt/decrypt cycle with large files (1MB+)
- [ ] Header structure validation (magic bytes, filename, size)
- [ ] Auth tag presence and length

## Running Specific Tests

```bash
# Run only crypto tests
npx vitest run tests/unit/crypto/

# Run only integration tests
npx vitest run tests/integration/

# Run with coverage
npx vitest run --coverage
```
