# 0.3 — Baseline de tests v0.3.0

## Por qué

Cualquier refactor de las Fases 1–4 tocará criptografía y autenticación. Necesitamos un **número de referencia** ("69 tests verdes") y una **cobertura mínima** que ningún commit posterior pueda reducir sin justificación.

## Snapshot de tests (rama `main`, commit `3af01a1`)

```
Test Files  10 passed     ← pre-Fase 0
Tests       69 passed     ← pre-Fase 0
```

Tras crear el golden test de Fase 0 (`tests/regression/format-v1-scrypt.test.ts`):

```
Test Files  11 passed
Tests       75 passed     ← 69 + 6 golden
Duración    14.26s
```

Distribución actual:

```
tests/
├── unit/
│   ├── crypto/          fileCipher.test.ts, keyDerivation.test.ts
│   ├── database/        userRepository, sessionRepository, webauthnRepository
│   ├── passwordManager/ passwordValidator, secureStorage
│   └── session/         sessionStore
├── integration/
│   ├── auth.test.ts
│   ├── directoryProcessing.test.ts
│   └── fullEncryptDecrypt.test.ts
├── stress/              (carga / paralelismo)
└── benchmarks/          (no en CI)
```

## Cobertura baseline

Se ejecuta `npx vitest run --coverage` y se sube como artifact `coverage-report` (CI ya lo hace).
Para Fase 0 se captura el porcentaje numérico:

```powershell
npx vitest run --coverage --reporter=json | Out-File auditoria_fase0/coverage-baseline.json -Encoding utf8
```

Mínimos exigidos a partir de ahora (gate de PR):

| Capa | Cobertura mínima | Comentario |
|------|------------------|------------|
| `src/crypto/` | **90%** | Es el núcleo. Ningún PR la baja. |
| `src/web/middleware/` | **85%** | Path sandbox, sesión. |
| `src/web/routes/` | **75%** | Routers. |
| `src/passwordManager/` | **85%** | KDF storage. |
| **Global** | **75%** | Suelo general. |

## Política "no regresión"

En `vitest.config.ts` se puede añadir (Fase 1) un threshold:

```ts
coverage: {
  thresholds: {
    lines: 75, functions: 75, branches: 70, statements: 75,
    './src/crypto/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
  }
}
```

Cualquier PR que rompa el threshold **falla CI**.

## Comparación post-fase

Al final de cada fase posterior:
```powershell
npx vitest run --coverage --reporter=json > coverage-postfase.json
node scripts/compare-coverage.mjs coverage-baseline.json coverage-postfase.json
```
(Script utilitario a crear en Fase 1 si no existe.)
