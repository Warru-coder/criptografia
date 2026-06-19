# ADR-0017: Migración vitest 2 → 4 y cierre de advisories devDeps

- **Estado:** Aceptado e implementado
- **Fecha:** 2026-06-19
- **Fase:** 4

## Contexto

`npm audit` reportaba 7 vulnerabilidades (1 low, 3 moderate, 1 high, 2 critical) provenientes íntegramente de la cadena devDep de `vitest@2` → `vite@5` → `esbuild`. Fase 0 dejó pospuesta la migración a vitest 4 porque era major-bump y tocaba todo el harness de tests.

## Decisión

Actualizar `vitest` y `@vitest/coverage-v8` de `^2.1.8` a `^4.1.9` (latest).

## Resultado

- **Antes:** 7 vulnerabilidades (1L / 3M / 1H / 2C).
- **Después:** 2 low (solo `esbuild` vía `@yao-pkg/pkg`, herramienta de packaging usada únicamente offline para generar el binario distribuible; sin servidor de desarrollo expuesto).
- Suite completa: **85/85 verde** (incluye 2 nuevos tests SSE de Fase 4).

## Por qué no se aplica `npm audit fix` para el resto

Los 2 low remanentes provienen de `@yao-pkg/pkg`, que no expone servidor de desarrollo en runtime — el aviso describe lectura arbitraria de ficheros cuando `esbuild` sirve dev en Windows. SecureCrypt usa `pkg` solo offline para empaquetar `dist/securecrypt.exe`; no hay superficie de ataque en producción. Aceptado como riesgo residual hasta que `@yao-pkg/pkg` actualice su esbuild interno.

## Verificación

- [x] `npx vitest run tests/integration tests/unit tests/regression` → 85/85.
- [x] `npm audit --omit=dev` → 0 vulnerabilities.
- [x] `npm audit` → 2 low (esbuild en pkg, justificado arriba).

## Referencias

- ADR-0007 (Fase 0) — plan original de migración vitest 4.
- GHSA-g7r4-m6w7-qqqr — esbuild dev server (no aplicable aquí).
