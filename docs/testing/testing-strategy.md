# Estrategia de Testing — SecureCrypt

---

## 1. Estado Actual

| Subproyecto | Framework | Tests actuales | Cobertura estimada |
|---|---|---|---|
| Node.js/TypeScript | Vitest | 34 tests | ~45% |
| Windows C++ | Custom macro framework | 16 tests | ~25% |
| Android Kotlin | JUnit4 + Mockk | 12 tests | ~30% |

**Objetivo**: ≥80% cobertura en Node.js, ≥60% en C++/Android (para TFM)

---

## 2. Pirámide de Tests

```
           /\
          /  \
         / E2E\        5% — 3-5 tests de flujo completo
        /──────\
       /  INT.  \      20% — tests de integración entre capas
      /──────────\
     /   UNIT     \    75% — tests unitarios por módulo
    /______________\
```

---

## 3. Tests Unitarios

### 3.1 Node.js — Gaps a Cubrir

#### `src/crypto/` — Prioridad ALTA
```typescript
// EXISTENTE: keyDerivation, fileCipher ✅

// FALTANTE: vault.ts
describe('Vault', () => {
  it('should throw if vault does not exist on unlock', ...)
  it('should create vault with correct structure', ...)
  it('should reject wrong master password', ...)
  it('should unlock and return derived key', ...)
});

// FALTANTE: engine.ts (duplicado de cryptoUtils — considerarlo para eliminar)
// Si se mantiene, necesita tests propios
```

#### `src/web/routes/apiRoutes.ts` — Prioridad CRÍTICA
```typescript
describe('Path Sandbox Middleware', () => {
  it('should reject paths escaping the base directory', () => {
    expect(() => sandboxPath('../../../etc/passwd')).toThrow(ForbiddenPathError);
    expect(() => sandboxPath('../../Windows/System32')).toThrow(ForbiddenPathError);
  });
  
  it('should accept valid paths within base directory', () => {
    expect(() => sandboxPath('documents/file.txt')).not.toThrow();
  });
  
  it('should resolve symlinks before validation', ...)
});

describe('Session Middleware', () => {
  it('should reject requests without valid session token', ...)
  it('should accept requests with valid session token', ...)
  it('should expire sessions after configured timeout', ...)
});
```

#### `src/core/vault.ts` — Prioridad ALTA
```typescript
describe('MasterKey', () => {
  it('should not be serializable to JSON', ...)
  it('should be cleared from memory on explicit dispose', ...)
});
```

#### `src/ai/` (módulo nuevo) — Prioridad ALTA
```typescript
describe('ConfigAuditor', () => {
  it('should flag Argon2id with memoryCost < 19456 KB as insecure', ...)
  it('should flag PBKDF2 with < 600000 iterations as insecure', ...)
  it('should approve Argon2id with OWASP parameters', ...)
  it('should return structured JSON output', ...)
  it('should not leak file contents to the LLM', ...)
});

describe('RAGService', () => {
  it('should return relevant chunks for a crypto question', ...)
  it('should include source references in response', ...)
  it('should not hallucinate standards references', ...)
});
```

### 3.2 C++ — Tests Adicionales Necesarios

```cpp
// FALTANTE: path validation (cuando se implemente)
TEST(PathValidation, RejectsTraversalAttempts) {
    EXPECT_THROW(SandboxPath("../../Windows/system32"), ForbiddenPathException);
}

// FALTANTE: KDF timing (cuando se reemplace por libsodium)
TEST(KeyDerivation, Argon2idIsConsistent) {
    auto k1 = DeriveKey("password", salt, params);
    auto k2 = DeriveKey("password", salt, params);
    EXPECT_EQ(k1, k2);
}

TEST(KeyDerivation, DifferentPasswordsDifferentKeys) {
    auto k1 = DeriveKey("password1", salt, params);
    auto k2 = DeriveKey("password2", salt, params);
    EXPECT_NE(k1, k2);
}

// FALTANTE: VerifyMasterPassword (corregir bug CRIT-005 primero)
TEST(Auth, VerifyCorrectPassword) {
    SetMasterPassword("correct_password");
    EXPECT_TRUE(VerifyMasterPassword("correct_password"));
}

TEST(Auth, RejectWrongPassword) {
    SetMasterPassword("correct_password");
    EXPECT_FALSE(VerifyMasterPassword("wrong_password"));
}

// FALTANTE: timing attack resistance
TEST(Auth, ComparisonIsConstantTime) {
    // Medir tiempo de comparación para hashes completamente distintos vs. distintos en último byte
    // El tiempo NO debe diferir estadísticamente
    auto t1 = MeasureComparisonTime(hash_a, hash_totally_different);
    auto t2 = MeasureComparisonTime(hash_a, hash_differs_only_last_byte);
    EXPECT_NEAR(t1, t2, timing_tolerance_ns);
}
```

---

## 4. Tests de Integración

### 4.1 Node.js — Nuevos
```typescript
// tests/integration/session.test.ts
describe('Session + API Integration', () => {
  it('should complete encrypt flow with session auth', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Test@123456' });
    
    const token = loginRes.body.sessionToken;
    
    const encryptRes = await request(app)
      .post('/api/encrypt')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testFilePath);
    
    expect(encryptRes.status).toBe(200);
    expect(encryptRes.body.fileName).toMatch(/\.scrypt$/);
  });
  
  it('should reject request without session token', ...)
  it('should reject expired session token', ...)
});

// tests/integration/pathSandbox.test.ts
describe('Path Sandbox Integration', () => {
  it('should reject path traversal in encrypt-dir endpoint', async () => {
    const res = await request(app)
      .post('/api/encrypt-dir')
      .send({ inputPath: '../../../', outputPath: '/tmp/evil' });
    expect(res.status).toBe(403);
  });
});
```

### 4.2 Cross-Platform Interoperability
```typescript
// tests/integration/crossPlatform.test.ts
describe('Cross-Platform Compatibility', () => {
  // Después de implementar KDF unificado (Fase 1 Sprint 1)
  it('should decrypt a file encrypted by the C++ version', async () => {
    // Archivo .scrypt generado por la app Windows
    const cppEncryptedFile = 'tests/fixtures/cpp-encrypted.scrypt';
    const result = await decryptFile(cppEncryptedFile, 'testpassword');
    expect(result).toEqual(expectedContent);
  });
  
  it('file encrypted in Node.js should decrypt in C++', ...)
  it('file encrypted in Android should decrypt in Node.js', ...)
});
```

---

## 5. Tests End-to-End

### 5.1 CLI E2E (Shell scripts + Vitest)
```typescript
// tests/e2e/cli.test.ts
describe('CLI E2E', () => {
  it('should encrypt and decrypt a file via CLI', async () => {
    await exec('node dist/cli encrypt tests/fixtures/sample.txt --password Test@123456');
    await exec('node dist/cli decrypt tests/fixtures/sample.txt.scrypt --password Test@123456');
    const content = await fs.readFile('tests/fixtures/sample.decrypted', 'utf8');
    expect(content).toBe(originalContent);
  });
  
  it('should fail gracefully with wrong password', ...)
  it('should handle interruption and resume via checkpoint', ...)
});
```

### 5.2 API Web E2E (Playwright o supertest)
```typescript
// tests/e2e/web.test.ts
describe('Web API E2E', () => {
  let sessionToken: string;
  
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ password: TEST_PASSWORD });
    sessionToken = res.body.sessionToken;
  });
  
  it('should upload, encrypt, download, and decrypt a file', async () => {
    // Upload + encrypt
    const encryptRes = await request(app)
      .post('/api/encrypt')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('file', 'tests/fixtures/sample.pdf');
    
    const { downloadUrl } = encryptRes.body;
    
    // Download encrypted
    const downloadRes = await request(app).get(downloadUrl);
    expect(downloadRes.status).toBe(200);
    
    // Decrypt
    const decryptRes = await request(app)
      .post('/api/decrypt')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('file', Buffer.from(downloadRes.body), 'sample.pdf.scrypt');
    
    expect(decryptRes.body.content).toBe(originalContent);
  });
});
```

---

## 6. Tests de Seguridad

### 6.1 Fuzzing del Parser de Headers
```typescript
// tests/security/fuzz.test.ts
describe('Header Parser Fuzzing', () => {
  const malformedHeaders = [
    Buffer.alloc(0),                    // Empty
    Buffer.alloc(10),                   // Too short
    Buffer.from('NOTSCRYPT'),           // Wrong magic
    Buffer.from([0xFF, 0xFF, ...]),      // All 0xFF
    // Fuzzing generado
    ...generateFuzzInputs(1000),
  ];
  
  for (const input of malformedHeaders) {
    it(`should not crash on input: ${input.slice(0, 6).toString('hex')}`, () => {
      expect(() => parseHeader(input)).toThrow(InvalidHeaderError);
    });
  }
});
```

### 6.2 Tests de Timing Attack
```typescript
// tests/security/timing.test.ts
describe('Constant-Time Operations', () => {
  it('password verification should take similar time for wrong and correct', async () => {
    const correctTime = await measureTime(() => verifyVaultPassword('correct_pass', vault));
    const wrongTime = await measureTime(() => verifyVaultPassword('wrong_pass_x', vault));
    
    // Diferencia no debe superar 10ms (variable del sistema, no del algoritmo)
    expect(Math.abs(correctTime - wrongTime)).toBeLessThan(10);
  });
});
```

### 6.3 Tests de Path Traversal
```typescript
// tests/security/pathTraversal.test.ts
const traversalPayloads = [
  '../../../etc/passwd',
  '..\\..\\..\\Windows\\System32',
  '%2e%2e%2f%2e%2e%2fetc',
  '....//....//etc',
  '/absolute/path',
  'C:\\Windows\\System32',
];

describe('Path Traversal Prevention', () => {
  for (const payload of traversalPayloads) {
    it(`should reject: ${payload}`, () => {
      expect(() => sandboxPath(payload)).toThrow(ForbiddenPathError);
    });
  }
});
```

---

## 7. Tests de Rendimiento

### 7.1 Benchmarks de Cifrado
```typescript
// tests/perf/encryption.bench.ts (Vitest bench)
bench('encrypt 1MB file', async () => {
  await encryptFile(oneMBFile, masterKey, outputPath);
});

bench('encrypt 100MB file', async () => {
  await encryptFile(hundredMBFile, masterKey, outputPath);
});

bench('encrypt 1GB file', async () => {
  await encryptFile(oneGBFile, masterKey, outputPath);
}, { timeout: 300000 });

bench('Argon2id key derivation (OWASP params)', async () => {
  await deriveKey('password', salt, { memoryCost: 65536, timeCost: 3, parallelism: 2 });
});
```

### 7.2 Resultados Esperados (hardware de referencia: i7-8th gen, SSD NVMe)
| Operación | Tiempo esperado |
|---|---|
| Cifrar 1MB | < 100ms |
| Cifrar 100MB | < 2s |
| Cifrar 1GB | < 15s |
| Descifrar 1GB | < 15s |
| Derivar clave (Argon2id OWASP) | 200-500ms |
| 20 cifrados concurrentes × 1MB | < 3s |

---

## 8. CI/CD y Calidad Automática

### `.github/workflows/ci.yml` — Actualizado

```yaml
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - name: Dependency audit
        run: npm audit --audit-level=high
      - name: License check
        run: npx license-checker --failOn GPL --excludePrivatePackages

  lint:
    needs: security
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
      - name: Coverage gate
        run: npx vitest run --coverage --coverage.thresholds.lines=80

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with: { languages: typescript }
```

### Herramientas de Calidad Local

```json
// package.json scripts adicionales
{
  "scripts": {
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:security": "vitest run tests/security",
    "test:bench": "vitest bench",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "lint": "eslint src tests --max-warnings 0",
    "format": "prettier --write src tests",
    "format:check": "prettier --check src tests",
    "type-check": "tsc --noEmit",
    "audit": "npm audit --audit-level=high"
  }
}
```

### ESLint Config Recomendada
```javascript
// eslint.config.js
export default [
  { plugins: { security: eslintPluginSecurity } },
  {
    rules: {
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-object-injection': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    }
  }
];
```
