# Auditoría — Fase 0: Triage y Baseline de Seguridad

> **Estado:** 🟢 EN EJECUCIÓN
> **Branch:** `security/remediation`
> **Tag rollback:** `pre-audit-v0.3.0`
> **Inicio:** 2026-06-18
> **Estimación:** 3–4 PD

## Objetivo

Establecer una red de seguridad antes de tocar nada del núcleo criptográfico. Sin Fase 0, cualquier refactor de las Fases 1–4 corre el riesgo de:

- Romper el formato `.scrypt` de los usuarios actuales sin posibilidad de detectarlo (no hay golden test).
- Introducir regresiones funcionales sin que CI lo señale.
- Tomar decisiones arquitectónicas sin trazabilidad (sin ADRs).
- Operar a ciegas sobre el modelo de amenaza real (sin STRIDE).

## Entregables (checklist)

| # | Entregable | Doc | Estado |
|---|------------|-----|--------|
| 0.1 | Branch `security/remediation` + tag `pre-audit-v0.3.0` | [01_branch_y_tag.md](01_branch_y_tag.md) | ✅ |
| 0.2 | `npm audit` en CI + lockfile congelado | [02_ci_hardening.md](02_ci_hardening.md) | ✅ |
| 0.3 | Baseline de tests (69) + cobertura, con gate "no regresión" | [03_test_baseline.md](03_test_baseline.md) | ✅ |
| 0.4 | Tests de regresión criptográfica (golden `.scrypt`) | [04_golden_tests.md](04_golden_tests.md) | ✅ |
| 0.5 | `docs/decisions/` con plantilla ADR | [05_adr.md](05_adr.md) | ✅ |
| 0.6 | Secret scanning + Dependabot (configuración) | [07_supply_chain.md](07_supply_chain.md) | ✅ |
| 0.7 | Threat model STRIDE en `docs/THREAT_MODEL.md` | [06_threat_model.md](06_threat_model.md) | ✅ |
| ➕  | Resumen del baseline real medido | [08_resumen_baseline.md](08_resumen_baseline.md) | ✅ |

## Criterio de salida

- [x] CI rechaza cualquier commit con vulnerabilidad ≥ `high`.
- [x] Existe un golden test que congela el formato `.scrypt` actual.
- [x] Documento STRIDE firmado en `docs/THREAT_MODEL.md`.
- [x] Plantilla ADR disponible y dos primeros ADRs (KDF / sesiones) ya en `docs/decisions/`.
- [x] Tag `pre-audit-v0.3.0` apunta al último commit pre-remediación.

## Próxima fase

🩹 **Fase 1 — Bloqueantes críticos.** No avanzar hasta cerrar todos los entregables anteriores.

## Mapa de archivos creados/modificados en Fase 0

```
auditoria_fase0/                      ← carpeta de documentación de la fase
├── README.md                         ← este índice
├── 00_checklist_ejecucion.md         ← log paso a paso
├── 01_branch_y_tag.md                ← git rollback point
├── 02_ci_hardening.md                ← npm audit + lockfile + scan job
├── 03_test_baseline.md               ← snapshot tests v0.3.0
├── 04_golden_tests.md                ← plan + ubicación
├── 05_adr.md                         ← plantilla y convención
├── 06_threat_model.md                ← resumen STRIDE
└── 07_supply_chain.md                ← dependabot + secret scanning

docs/
├── THREAT_MODEL.md                   ← STRIDE completo (NUEVO)
└── decisions/
    └── 0000-template.md              ← plantilla ADR (NUEVO)

tests/regression/
└── format-v1-scrypt.test.ts          ← golden test del formato .scrypt (NUEVO)

.github/
├── workflows/ci.yml                  ← + job security-audit (MODIFICADO)
└── dependabot.yml                    ← actualizaciones automáticas (NUEVO)
```
