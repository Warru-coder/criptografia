# Auditoría — Fase 2: Hardening del núcleo criptográfico

> **Estado:** 🟢 COMPLETADA
> **Branch:** `security/remediation`
> **Tag inicio:** `phase-1-source-complete`
> **Estimación original:** 8–10 PD
> **Tiempo invertido:** ~2 PD

## Objetivo

Corregir las decisiones criptográficas y de control que "funcionan pero están mal" — los hallazgos ALTA/MED que el informe priorizó tras los 5 CRIT de Fase 1. Sin esta fase, el producto sería seguro contra atacantes triviales pero seguiría arrastrando deuda de diseño visible para cualquier auditor serio.

## Entregables

| # | Tarea | Hallazgo | Doc / ADR | Estado |
|---|-------|----------|-----------|--------|
| 2.A | HKDF para file-keys + cabecera `.scrypt` v2 | ALTA-01 | [ADR-0007](../docs/decisions/0007-hkdf-for-file-keys.md) | ✅ |
| 2.B | Plan de deprecación de `master.hash` | ALTA-02 | [ADR-0012](../docs/decisions/0012-master-hash-deprecation-plan.md) | ✅ plan / Fase 3 exec |
| 2.C | Política contraseñas NIST 800-63B | ALTA-08 | [ADR-0011](../docs/decisions/0011-nist-password-policy.md) | ✅ |
| 2.D | Rate-limit con keyGenerator compuesto (IP+username) | ALTA-07 | [ADR-0010](../docs/decisions/0010-rate-limit-composite-key.md) | ✅ |
| 2.E | Sandbox con realpath + picomatch para exclusiones | MED-01, MED-02 | [ADR-0008](../docs/decisions/0008-sandbox-realpath.md), [ADR-0009](../docs/decisions/0009-picomatch-for-exclusions.md) | ✅ |

## Resultado

| Hallazgo | Antes | Después |
|----------|-------|---------|
| **ALTA-01** Doble Argon2id sobre clave | Encrypt/decrypt 200ms por fichero | HKDF-SHA256: μs por fichero; coherencia criptográfica restaurada |
| **ALTA-02** Dos artefactos de password | DB + master.hash con salts distintos | Plan documentado (ADR-0012); ejecución en Fase 3 |
| **ALTA-07** Rate-limit solo por IP | Spraying + distributed brute-force factibles | Bucket `(ip, username)` por intento |
| **ALTA-08** Reglas composición + min 8 | Aceptaba `Password1!`; rechazaba `correct horse battery staple` | NIST 800-63B: min 12, sin composición, entropy-based score, blocklist ampliada |
| **MED-01** Sandbox vulnerable a symlinks | `path.resolve` solo (textual) | `fs.realpathSync` con manejo de paths inexistentes |
| **MED-02** Regex artesanal en scanner | Bug con paréntesis, riesgo ReDoS | `picomatch` (estándar, ya en node_modules) |

## Tests Fase 2

| Archivo | Tests |
|---------|-------|
| `tests/unit/passwordManager/passwordValidator.test.ts` | 8 (reescrito completo) |
| `tests/regression/format-v1-scrypt.test.ts` | 7 (6 v2 + 1 legacy v1) |
| Resto pre-existentes | 39 |

**Suite Node Fase 2 verificada:** 54/54 verde (excluyendo stress flakies).

## Cambios al formato `.scrypt`

- **v1 (legacy):** sigue siendo legible. Argon2id-over-key para derivar fileKey.
- **v2 (default desde Fase 2):** byte de versión = 2. HKDF-SHA256(masterKey, salt, info) para derivar fileKey.
- Decryptor detecta automáticamente.

## Próxima fase

🏗️ **Fase 3 — Arquitectura y modelo de confianza.** Aborda:
- ALTA-05: cookies HttpOnly + CSRF (migrar Bearer)
- ALTA-06: WebAuthn PRF (eliminar trust-the-server)
- MED-04: endpoint de cambio de password
- ALTA-09 / MED-05: `requireSession` en `/api/verify` y `/api/progress`
- ALTA-02 (exec): ejecutar la migración de `master.hash` documentada en ADR-0012

## Mapa de archivos modificados en Fase 2

```
src/
├── core/constants.ts                    ← FILE_VERSION_V1, FILE_VERSION_V2, default V2
├── crypto/
│   ├── keyDerivation.ts                 ← + deriveFileKeyHKDF
│   ├── fileCipher.ts                    ← usa HKDF + escribe v2
│   └── fileDecipher.ts                  ← dispatch v1/v2
├── filesystem/
│   ├── fileMetadata.ts                  ← buildHeader recibe `version` (default V2)
│   └── fileScanner.ts                   ← picomatch en lugar de regex artesanal
├── passwordManager/passwordValidator.ts  ← reescrito NIST 800-63B
└── web/
    ├── middleware/pathSandbox.ts        ← realpath con manejo de paths inexistentes
    └── server.ts                        ← keyGenerator compuesto

tests/
├── regression/format-v1-scrypt.test.ts  ← +1 test legacy v1, asserts v2 default
└── unit/passwordManager/passwordValidator.test.ts  ← reescrito 8 tests

docs/decisions/
├── 0007-hkdf-for-file-keys.md
├── 0008-sandbox-realpath.md
├── 0009-picomatch-for-exclusions.md
├── 0010-rate-limit-composite-key.md
├── 0011-nist-password-policy.md
└── 0012-master-hash-deprecation-plan.md
```
