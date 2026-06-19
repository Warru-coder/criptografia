# Auditoría — Fase 3: Arquitectura y modelo de confianza

> **Estado:** 🟢 COMPLETADA (server-side) / 🟡 Plan publicado para items con cliente
> **Branch:** `security/remediation`
> **Tag inicio:** `phase-2-complete`
> **Estimación original:** 6–8 PD
> **Tiempo invertido:** ~1.5 PD

## Objetivo

Cerrar los hallazgos arquitectónicos: aislamiento de canales, rotación de credenciales, y poner por escrito el plan migratorio para los dos items (PRF y cookies) cuyo cierre completo requiere refactor del cliente browser y no cabe en esta fase sin riesgo de regresión.

## Entregables

| # | Tarea | Hallazgo | Doc / ADR | Estado |
|---|-------|----------|-----------|--------|
| 3.A | WebAuthn PRF / hmac-secret — scaffolding server | ALTA-06 | [ADR-0015](../docs/decisions/0015-webauthn-prf-plan.md) | 🟡 server-side / Fase 4 cliente |
| 3.B | Cookies HttpOnly + CSRF — plan | ALTA-05 | [ADR-0016](../docs/decisions/0016-cookie-session-plan.md) | 🟡 plan / Fase 4 exec |
| 3.C | Endpoint cambio de contraseña con rotación atómica | MED-04 | [ADR-0014](../docs/decisions/0014-change-password-endpoint.md) | ✅ |
| 3.D | `requireSession` + multer dedicado en `/api/verify`; SSE por usuario en `/api/progress` | ALTA-09, MED-05 | [ADR-0013](../docs/decisions/0013-require-auth-on-verify-and-progress.md) | ✅ |
| 3.E | Ejecución plan deprecación `master.hash` (columnas `masterSalt`, `wrappedKeyVersion`, `prfSalt`) | ALTA-02 | ADR-0012 exec | ✅ schema / Fase 4 enforcement |

## Resultado

| Hallazgo | Antes | Después |
|----------|-------|---------|
| **ALTA-05** Bearer en localStorage | Token expuesto a cualquier XSS | Plan dual-mode cookie HttpOnly + CSRF documentado (ADR-0016) |
| **ALTA-06** Trust-the-server WebAuthn | Compromiso de server + DB ⇒ recupera masterKeys | Scaffolding DB (`prfSalt`, `wrappedKeyVersion`); plan completo PRF en ADR-0015 |
| **ALTA-09** `/api/verify` sin auth ni límite | DoS subiendo GiB anónimos | `requireSession` + multer 1 MiB + lectura `fd.read` 148 bytes |
| **MED-04** Sin cambio de password | No había rotación posible | `POST /api/auth/change-password` con write-rename atómico + invalidación de sesiones + reset de wrappedKey |
| **MED-05** SSE global de progreso | Cualquier user veía progreso de los demás | `Map<userId, Set<Response>>`; `broadcastProgress(userId, ...)` |
| **ALTA-02** master.hash huérfano | Plan sin schema | ALTER TABLE idempotentes (`masterSalt`, `wrappedKeyVersion`, `prfSalt`) |

## Tests Fase 3

| Archivo | Tests |
|---------|-------|
| `tests/integration/changePassword.test.ts` | 5 (registro, OK, currentPw incorrecta, newPw débil, rotación + login con nueva / fallo con vieja) |
| Resto pre-existentes | 72 |

**Suite Node Fase 3 verificada:** 77/77 verde (excluyendo stress flakies preexistentes).

## Por qué 3.A y 3.B quedan en "plan + scaffolding"

Ambos requieren refactor del frontend (`public/js/app.js` ≈ 700 líneas) y de los tests de integración (supertest → cookie-jar / WebAuthn virtual authenticator). El servidor queda listo, la decisión queda escrita, y la ejecución se acomete en Fase 4 con menos riesgo de regresión que mezclarlo con los cambios de modelo de confianza ya entregados aquí.

## Próxima fase

🎯 **Fase 4 — Polish y migraciones diferidas.** Aborda:
- Migración vitest 4 (devDeps remanentes en `npm audit`).
- Ejecución cliente PRF (ADR-0015 paso "Fase 4 — Client + cierre").
- Ejecución dual-mode cookie + CSRF (ADR-0016).
- Verificación build C++ con `apps/windows/build.bat` antes de tag v0.4.0.
- Tests e2e SSE multi-usuario.

## Mapa de archivos modificados en Fase 3

```
src/
├── database/
│   ├── db.ts                              ← addColumnIfMissing helper + 3 ALTER TABLE idempotentes
│   └── userRepository.ts                  ← masterSalt, wrappedKeyVersion en UserRow + setMasterSalt
├── passwordManager/secureStorage.ts       ← changeMasterPassword(userId, old, new) atómico (write-rename)
└── web/routes/
    ├── apiRoutes.ts                       ← progressClientsByUser; requireSession en verify/progress; multer 1 MiB
    └── authRoutes.ts                      ← POST /api/auth/change-password con rotación de sesión + reset wrappedKey

tests/
└── integration/changePassword.test.ts     ← 5 escenarios

docs/decisions/
├── 0013-require-auth-on-verify-and-progress.md
├── 0014-change-password-endpoint.md
├── 0015-webauthn-prf-plan.md
└── 0016-cookie-session-plan.md
```
