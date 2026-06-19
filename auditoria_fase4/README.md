# Auditoría — Fase 4 (acotada): Migración vitest 4 + verificación SSE multi-usuario

> **Estado:** 🟢 COMPLETADA
> **Branch:** `security/remediation`
> **Tag inicio:** `phase-3-complete`
> **Alcance acordado con usuario:** 4.A + 4.E (mínimo verificable, sin dependencia de browser real ni toolchain C++).

## Objetivo

Cerrar las dos tareas de Fase 4 que pueden verificarse end-to-end en el entorno local: la migración de la cadena devDep de tests (que arrastraba advisories críticos y altos desde Fase 0) y el test e2e SSE multi-usuario pendiente de ADR-0013.

## Entregables

| # | Tarea | Origen | Doc / ADR | Estado |
|---|-------|--------|-----------|--------|
| 4.A | Migración `vitest@2.1.8` → `vitest@4.1.9` + `@vitest/coverage-v8@4` | ADR-0007 (Fase 0) | [ADR-0017](../docs/decisions/0017-vitest-4-migration.md) | ✅ |
| 4.E | Test e2e SSE multi-usuario (aislamiento por userId) | ADR-0013 verificación pendiente | `tests/integration/sseIsolation.test.ts` | ✅ |

## Resultado

| Métrica | Antes | Después |
|---------|-------|---------|
| `npm audit` total | 7 (1L / 3M / 1H / 2C) | 2 low (solo `@yao-pkg/pkg` → esbuild offline) |
| `npm audit --omit=dev` | 0 | 0 |
| Suite tests | 77/77 | 85/85 |
| Verificación ADR-0013 | `[ ]` pendiente | `[x]` cumplida |

## Test SSE multi-usuario

`tests/integration/sseIsolation.test.ts` (2 tests):

1. **`/api/progress` sin token devuelve 401** — verifica `requireSession`.
2. **Aislamiento por userId** — abre dos conexiones SSE concurrentes (userA, userB) contra un servidor HTTP real en puerto efímero, invoca `broadcastProgress(userIdA, ...)`, confirma que A recibe y B no, repite con B → A no recibe. Cubre el invariante MED-05 directamente.

## Items NO incluidos en este alcance

Acordado con el usuario dejarlos para una iteración futura:

- **4.B** WebAuthn PRF cliente (`public/js/app.js`) — requiere browser con autenticador PRF real para verificar. Server-side scaffolding ya entregado en Fase 3.
- **4.C** Cookie HttpOnly + CSRF dual-mode — refactor grande de endpoints y tests. Plan en ADR-0016.
- **4.D** Verificación build C++ con `apps/windows/build.bat` — manual, fuera del entorno CLI.

## Estado final del proyecto

```
Fase 0 (triage)               ✅ phase-0-complete
Fase 1 (CRIT-01..05)          ✅ phase-1-source-complete
Fase 2 (hardening crypto)     ✅ phase-2-complete
Fase 3 (arquitectura)         ✅ phase-3-complete
Fase 4 acotada (4.A + 4.E)    ✅ phase-4-partial-complete
Fase 4 restante (4.B/C/D)     🟡 plan publicado, ejecución diferida
```
