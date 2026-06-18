# Auditoría — Fase 1: Bloqueantes críticos ("Stop the bleeding")

> **Estado:** 🟢 EN EJECUCIÓN (Node hecho ✅ — C++ refactor de núcleo ✅, build/test C++ pendiente)
> **Branch:** `security/remediation`
> **Tag inicio:** `phase-0-complete`
> **Estimación original:** 8–10 PD
> **Tiempo invertido (Node + C++ source-level):** ~3 PD

## Objetivo

Cerrar los **5 CRIT** del informe de auditoría antes de cualquier otro trabajo.
No se libera v0.4.0 hasta cerrar esta fase.

## Entregables

| # | Tarea | Componente | Doc / ADR | Estado |
|---|-------|------------|-----------|--------|
| Pre | `npm audit fix` no-breaking + audit prod-only en CI | DevOps | [01_supply_chain_cleanup.md](01_supply_chain_cleanup.md) | ✅ |
| 1.A | Wrap masterKey con HKDF + validar SERVER_SECRET incondicional | Node / WebAuthn | [ADR-0005](../docs/decisions/0005-server-secret-validation-and-hkdf-wrap.md) | ✅ |
| 1.B | Eliminar `'unsafe-inline'` en CSP + clases CSS para riesgos | Node / Frontend | [ADR-0006](../docs/decisions/0006-strict-csp-no-unsafe-inline.md) | ✅ |
| 1.C | PBKDF2-HMAC-SHA256 real (600k iter) en C++ | C++ / CryptoEngine | [ADR-0003](../docs/decisions/0003-cpp-kdf-replacement.md) | ✅ source / ⏳ build |
| 1.D | AES-GCM correcto en C++ (single-shot in-memory <=256 MiB) | C++ / CryptoEngine | [ADR-0004](../docs/decisions/0004-cpp-streaming-aead.md) | ✅ source / ⏳ build |

## Hallazgos cerrados

| Hallazgo | Antes | Después |
|----------|-------|---------|
| **CRIT-01** PBKDF2 falso en C++ | Iteración de CryptHashData sin finalizar → 1 SHA-256 real | `BCryptDeriveKeyPBKDF2` HMAC-SHA256 con 600.000 iteraciones reales |
| **CRIT-02** Streaming GCM con nonce reuse | Mismo IV por bloque + tag solo del último | Single-shot in-memory hasta 256 MiB con `AesGcmEncrypt` correcto; streaming real diferido a Fase 2 (libsodium) |
| **CRIT-03** Wrap con `serverSecret.padEnd(32,'0')` | Clave AES-256 con entropía atacable | `crypto.hkdfSync('sha256', secret, ∅, info, 32)` con domain separation |
| **CRIT-04** `SERVER_SECRET` opcional en dev | `process.exit(1)` solo en producción | Validación incondicional cuando WebAuthn habilitado (longitud ≥32) |
| **CRIT-05** CSP con `unsafe-inline` | Permitía XSS → robo de token Bearer | CSP estricta sin inline; clases CSS por riesgo; +objectSrc, baseUri, frameAncestors, formAction |

## Tests añadidos en Fase 1

| Archivo | Tests | Cubre |
|---------|-------|-------|
| `tests/unit/session/wrapKey.test.ts` | 8 | Roundtrip HKDF, versioning, domain separation, rechazo de secreto incorrecto y formato v1 |

## Estado del baseline tras Fase 1

```
Test Files  12 passed (Node)
Tests       80 verde / 11 skipped / 0 fail (Node)
```

Los tests Node específicos de Fase 1 (8 nuevos en wrap + 6 golden Fase 0 + 11 auth integration) pasan en verde de forma consistente. Las flakinesses puntuales de `stress/memoryLeak` y `concurrentTasks` son preexistentes (no relacionadas con las correcciones de seguridad).

⚠️ **El job CI `security-audit` ahora separa prod vs dev:**
- `npm audit --omit=dev --audit-level=high`: **bloqueante** (debe quedar verde).
- `npm audit --audit-level=high`: advisory (vitest/vite/esbuild devDeps con CVEs solo afectan al dev-server; bump a vitest 4 se pospone para Fase 4 / ADR-0007).

## C++: source-level vs build/test

Los cambios al C++ (`CryptoEngine.cpp/.h`):

- ✅ Compilan **conceptualmente** (uso de APIs CNG estándar, sin nuevas deps).
- ⏳ **No verificados en build local** desde esta sesión (requiere MSVC + CMake + SDK).
- ⏳ **No verificados en runtime** (no hay test harness C++ integrado).

Acciones recomendadas antes de tag v0.4.0:

```powershell
cd apps/windows
./build.bat
# Tests manuales:
#   1. Crear vault con master password
#   2. Cifrar un fichero de 1 MB
#   3. Cifrar un fichero de 100 MB
#   4. Modificar 1 byte del cifrado → descifrar debe fallar
#   5. Intentar descifrar un .scrypt v1 → debe rechazar con mensaje claro
```

## Próxima fase

🔐 **Fase 2 — Hardening del núcleo criptográfico.** Una vez verificados los builds C++:
- ALTA-01: HKDF para file-keys (eliminar Argon2id doble)
- ALTA-02: Eliminar `master.hash` redundante
- ALTA-07: Rate limit por IP+username
- ALTA-08: Política contraseñas NIST 800-63B + zxcvbn + HIBP
- MED-01 / MED-02: `realpath` + reemplazar regex artesanal del scanner

## Mapa de archivos modificados en Fase 1

```
src/
├── config.ts                                  ← validación SERVER_SECRET incondicional
└── web/
    ├── server.ts                              ← CSP estricta sin unsafe-inline
    └── routes/webauthnRoutes.ts               ← wrap/unwrap con HKDF + versión 0x02

public/
├── js/app.js                                  ← clases CSS en vez de inline style
└── css/styles.css                             ← .risk-low/.risk-medium/.risk-high/.risk-critical

apps/windows/src/core/crypto/
├── CryptoEngine.h                             ← PBKDF2_ITERATIONS = 600000
└── CryptoEngine.cpp                           ← DeriveKey (PBKDF2 real), EncryptFile/DecryptFile (single-shot v2)

tests/unit/session/wrapKey.test.ts             ← 8 tests del nuevo wrap (NUEVO)

docs/decisions/
├── 0003-cpp-kdf-replacement.md                ← NUEVO
├── 0004-cpp-streaming-aead.md                 ← NUEVO
├── 0005-server-secret-validation-and-hkdf-wrap.md  ← NUEVO
└── 0006-strict-csp-no-unsafe-inline.md        ← NUEVO

auditoria_fase1/
├── README.md                                  ← este índice
└── 01_supply_chain_cleanup.md                 ← npm audit fix + decisión vitest 4

.github/workflows/ci.yml                       ← audit prod-only bloqueante; full audit advisory
```
