# Fase 0 — Log de ejecución paso a paso

Registro cronológico literal de comandos y decisiones. Útil para auditoría futura y para reproducir el setup.

## 2026-06-18

### T+0 — Tag rollback + branch
```powershell
git tag pre-audit-v0.3.0          # apunta a 3af01a1
git checkout -b security/remediation
# Salida: Switched to a new branch 'security/remediation'
```

### T+5 — Estructura de carpetas
```powershell
mkdir auditoria_fase0
mkdir tests\regression
```

### T+10 — CI: añadido job `security-audit`
- Modificado `.github/workflows/ci.yml`.
- Añadido `npm audit --audit-level=high` que ROMPE CI ante CVE high/critical.
- Añadido `actions/dependency-review-action` para PRs.

### T+25 — Baseline de tests
```powershell
npm test -- --reporter=json --outputFile=auditoria_fase0/tests-baseline-v0.3.0.json
```
- Tests ejecutados: 69 (documentado en `03_test_baseline.md`).
- Cobertura registrada (commit-frozen).

### T+45 — Golden test del formato `.scrypt`
- Creado `tests/regression/format-v1-scrypt.test.ts`.
- Genera/lee fichero `.scrypt v1` con masterKey y password de test vectors fijos.
- Valida cabecera byte a byte + descifrado correcto.

### T+60 — Plantilla ADR
- Creado `docs/decisions/0000-template.md`.

### T+75 — Threat model STRIDE
- Creado `docs/THREAT_MODEL.md`.

### T+90 — Supply chain
- Creado `.github/dependabot.yml`.

### T+100 — Commit final de Fase 0
```powershell
git add auditoria_fase0/ docs/THREAT_MODEL.md docs/decisions/0000-template.md \
        tests/regression/ .github/workflows/ci.yml .github/dependabot.yml
git commit -m "chore(security): fase 0 — triage y baseline de seguridad

- Tag pre-audit-v0.3.0 como punto de rollback.
- Branch security/remediation para el trabajo de remediación.
- CI: añadido job security-audit (npm audit --audit-level=high).
- tests/regression/: golden test que congela el formato .scrypt v1.
- docs/THREAT_MODEL.md: STRIDE inicial por componente.
- docs/decisions/0000-template.md: plantilla ADR.
- .github/dependabot.yml: updates semanales de dependencias.
- auditoria_fase0/: documentación completa de la fase."
```
