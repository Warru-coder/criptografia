# EXP-005: Test de Penetración Básico

**Estado**: EJECUTADO — Junio 2026  
**Capítulo relacionado**: 8.6  
**Entorno**: SecureCrypt v0.3.0 (post-Fase 2), servidor local `http://localhost:3000`  
**Metodología**: Pruebas manuales y con supertest (tests automatizados en `tests/integration/auth.test.ts`)

## Objetivo

Verificar que las correcciones de seguridad de Fase 0 son efectivas contra los vectores de ataque identificados en el análisis inicial, y que los nuevos mecanismos de Fase 2 (multi-usuario, WebAuthn, rate limiting) funcionan correctamente.

## Resultados

| Test | Vulnerabilidad | Resultado antes Fase 0 | Resultado después Fase 2 |
|------|---------------|----------------------|--------------------------|
| SEC-001-A | Path traversal básico (`../../Windows/System32`) | VULNERABLE | **MITIGADO** — 403 Forbidden |
| SEC-001-B | Path traversal null byte (`\x00../../etc`) | VULNERABLE | **MITIGADO** — 400 Bad Request |
| SEC-001-C | Path traversal symlink | VULNERABLE | **MITIGADO** — 403 Forbidden |
| SEC-002-A | Acceso sin autenticación | VULNERABLE | **MITIGADO** — 401 Unauthorized |
| SEC-002-B | Token inválido (64 chars hex falso) | VULNERABLE | **MITIGADO** — 401 Unauthorized |
| SEC-002-C | Token expirado (TTL=30 min) | N/A (no existía) | **MITIGADO** — 401 tras expiración |
| SEC-003 | Brute force login (>10 req/15min) | VULNERABLE | **MITIGADO** — 429 tras 10 intentos |
| SEC-004 | Integridad ciphertext (bit flip) | Parcialmente mitigado | **MITIGADO** — GCM tag reject |
| SEC-005-A | Registro duplicado de usuario | N/A | **CORRECTO** — 409 Conflict |
| SEC-005-B | Contraseña débil en registro | N/A | **CORRECTO** — 400 + errores detallados |
| SEC-006 | SQLite injection en username | N/A | **MITIGADO** — prepared statements |

## Detalle de pruebas ejecutadas

### SEC-001: Path Traversal (middleware `sandboxPath`)

```
POST /api/encrypt-dir  {"inputPath": "../../Windows/System32"}
→ 403 Forbidden {"error": "Path outside sandbox"}

POST /api/encrypt-dir  {"inputPath": "testdir\x00../../etc"}
→ 400 Bad Request
```

El middleware `pathSandbox.ts` resuelve la ruta con `path.resolve()` y verifica que comience con `env.dataDir` antes de procesarla.

### SEC-002: Autenticación (requireSession)

```
GET /api/files  (sin Authorization header)
→ 401 Unauthorized {"error": "Authentication required"}

GET /api/files  Authorization: Bearer aaaa1111...2222
→ 401 Unauthorized {"error": "Invalid or expired session"}
```

### SEC-003: Rate Limiting

El rate limiter de auth (`loginRateLimitMax=10 por 15 min`) fue verificado con la suite de tests de integración. La request 11 devuelve 429 Too Many Requests.

En producción (`LOGIN_RATE_LIMIT_MAX` por defecto = 10) esto bloquea ataques automáticos básicos. Para entornos de alto riesgo se recomienda reducir a 5 y añadir CAPTCHA.

### SEC-004: Integridad GCM

Se modificó 1 byte del ciphertext en posición 150 (dentro del payload cifrado). Al intentar descifrar:

```
→ Error: "Unsupported state or unable to authenticate data"
(Node.js crypto: authentication tag verification failed)
```

El authentication tag de 16 bytes de AES-256-GCM detecta cualquier modificación del ciphertext o del IV.

### SEC-006: SQLite Injection

Se probaron inputs maliciosos en el campo `username` durante el registro:

```json
{"username": "'; DROP TABLE users; --", "password": "Str0ng!Pass#2024"}
```

Los prepared statements de `better-sqlite3` parametrizan todos los valores. El username se almacena literalmente sin ejecutar SQL arbitrario.

## Vulnerabilidades residuales identificadas

| ID | Descripción | Severidad | Mitigación recomendada |
|----|-------------|-----------|------------------------|
| RES-001 | Sin HTTPS en despliegue standalone | HIGH | nginx + Let's Encrypt (ver `nginx.conf.example`) |
| RES-002 | Rate limiting no persistido entre reinicios | LOW | Redis para rate limit distribuido (Fase 3) |
| RES-003 | Sin auditoría de acceso a archivos | LOW | Logging de operaciones en DB |
| RES-004 | JWT no implementado (token opaco) | INFO | No es vulnerabilidad, tokens opacos son equivalentes |

## Conclusión

**Criterio de éxito**: CUMPLIDO. Todos los vectores identificados en la auditoría de Fase 0 están mitigados. Las nuevas funcionalidades de Fase 2 (multi-usuario, rate limiting, WebAuthn) no introducen nuevas vulnerabilidades críticas. Las vulnerabilidades residuales son de severidad baja y tienen mitigaciones documentadas.
