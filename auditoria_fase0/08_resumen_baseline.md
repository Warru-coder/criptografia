# Fase 0 — Resumen del baseline real (medido)

> Ejecutado el 2026-06-18 en branch `security/remediation` justo tras crear el tag
> `pre-audit-v0.3.0`. Cifras y hallazgos **medidos**, no estimados.

## Tests

```
Test Files  11 passed
Tests       75 passed
Duración    14.26s
```

Desglose:

| Categoría | Tests | Origen |
|-----------|-------|--------|
| Unit (crypto, db, passwordManager, session) | ~40 | Pre-existentes |
| Integration (auth, full encrypt/decrypt, dir) | ~20 | Pre-existentes |
| Stress (memoria, concurrencia) | 5 | Pre-existentes |
| Benchmarks | — | No en CI |
| **Regression (golden v1) ← NUEVO Fase 0** | **6** | Creado en Fase 0 |
| **TOTAL CI** | **75** | (69 baseline + 6 nuevos) |

✅ Los 75 tests pasan en verde sobre `security/remediation`.

## npm audit baseline

```
12 vulnerabilities (1 low, 5 moderate, 2 high, 4 critical)
```

**Importante:** todas en `devDependencies`, no en runtime. Sin embargo, **el gate
de CI que añadimos (`--audit-level=high`) FALLA hoy mismo**. Esto es deliberado:

- Es honesto: refleja el estado real heredado.
- Obliga a que la **primera acción de Fase 1** sea limpiar la deuda de supply chain.

### Detalle por dependencia

| Paquete | Severidad | Fix disponible | Comentario |
|---------|-----------|----------------|------------|
| `shell-quote` (via `concurrently`) | CRITICAL | `npm audit fix` | Solo dev (concurrently dev:all). |
| `form-data` (transitive) | HIGH | `npm audit fix` | Devdep. |
| `esbuild` (via `vitest`, `@yao-pkg/pkg`) | MODERATE | breaking (vitest 4) | Riesgo dev-server only. |
| `tar` | MODERATE | `npm audit fix` | Devdep. |
| `js-yaml` | MODERATE | `npm audit fix` | Devdep. |

### Plan inmediato (entra como primer commit de Fase 1)

```powershell
# 1. Fixes no-breaking primero
npm audit fix
# 2. Re-correr tests
npx vitest run
# 3. Re-correr audit
npm audit --audit-level=high
# 4. Si quedan moderate, documentar y aceptar (no rompen el gate high)
# 5. Si quedan high/critical, decidir: bump major (vitest 4) o aislar
```

### Por qué no se "ignoran" en `.npmrc`

Aceptar un CVE high/critical sin justificación viola la política de Fase 0
(documento `02_ci_hardening.md`). Si en Fase 1 una vuln no se puede arreglar sin
breaking change, se documenta vía **ADR** con análisis de impacto.

## Cobertura baseline

Pendiente de capturar con `--coverage`. Se ejecutará al inicio de Fase 1 como
parte de la limpieza de supply chain. El archivo `coverage-baseline.json` se
generará y se commitea junto al primer fix.

## Golden test del formato `.scrypt v1`

✅ Verde (6/6 tests). Congela:

- Cabecera v1: MAGIC (`SCRYPT`) + VERSION (`1`) + SALT(16) + IV(16) + Argon2 params.
- Argon2id m=65536 t=3 p=2 hashLength=32.
- AES-256-GCM con authTag 128 bits.
- Detecta tampering de 1 byte y password incorrecta.

Si un PR de las Fases 1–2 hace fallar este test, **bloqueante** hasta entender por qué.

## Threat model

✅ `docs/THREAT_MODEL.md` creado. STRIDE por componente con mapeo a hallazgos y fases.

## ADRs

✅ Plantilla en `docs/decisions/0000-template.md`. Lista de 10 ADRs a crear durante las Fases 1–4 enumerada en `05_adr.md`.

## Supply chain

✅ `.github/dependabot.yml` con updates semanales (npm) y mensuales (actions, docker).
✅ `.github/workflows/ci.yml` con job `security-audit` que bloquea pipeline.
⏳ Pendiente: activación manual de **Secret Scanning + Push Protection** en
   `Settings → Code security and analysis`. Acción del propietario del repo.

## Estado de salida Fase 0

| Criterio | Estado |
|----------|--------|
| Tag rollback `pre-audit-v0.3.0` | ✅ |
| Branch `security/remediation` | ✅ |
| Golden test del formato v1 | ✅ (6/6) |
| Threat model STRIDE | ✅ |
| Plantilla ADR | ✅ |
| Dependabot config | ✅ |
| CI security-audit job | ✅ (fallará hoy → input para Fase 1) |
| Documentación Fase 0 | ✅ (`auditoria_fase0/`) |
| Secret scanning activado | ⏳ Pendiente acción manual del owner |

✅ **Fase 0 cerrada. Listo para abrir Fase 1.**
