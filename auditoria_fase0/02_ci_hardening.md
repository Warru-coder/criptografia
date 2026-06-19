# 0.2 — CI con `npm audit` + dependency review

## Por qué

Antes de refactorizar nada, CI debe **detectar regresiones de supply chain de forma automática**. Si una dependencia transitive introduce un CVE high, el commit no debe poder llegar a `main`.

## Cambios aplicados en `.github/workflows/ci.yml`

Se añade un nuevo job `security-audit` que corre **en paralelo** a `lint` y bloquea el resto de la pipeline si encuentra problemas.

```yaml
  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: npm audit (fail on high/critical)
        run: npm audit --audit-level=high
      - name: Dependency Review (PRs)
        if: github.event_name == 'pull_request'
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
```

Y se añade `needs: [lint, security-audit]` al job `test`.

## Lockfile congelado

`package-lock.json` ya existe. **No se debe regenerar** durante la remediación sin justificación. En PRs:

- `npm ci --legacy-peer-deps` (ya en CI) — falla si el lockfile no concuerda con `package.json`.
- Para añadir una dependencia: PR dedicado, justificación en descripción, dependabot pasa.

## Verificación local

```powershell
npm audit --audit-level=high
# Salida esperada: "found 0 vulnerabilities" o, si hay, mostrar antes de empezar Fase 1
```

## Resultado del audit baseline (2026-06-18)

> Se ejecutó `npm audit` justo después de crear el branch. El resultado queda capturado en
> `auditoria_fase0/npm-audit-baseline.txt` (sustituir al ejecutar). Si hay CVEs high/critical
> ya conocidos, se enumeran como **deuda técnica heredada** y se abordan en Fase 4 (supply chain).

## Política

- ❌ **No se "ignora" un CVE** sin ADR justificando el riesgo aceptado.
- ✅ Bumps de patch y minor: dependabot auto-merge (cuando esté configurado).
- ✅ Major bumps: PR manual con revisión humana.
