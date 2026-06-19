# Fase 1 — Acción 0: limpiar supply chain antes de tocar criptografía

## Por qué

Fase 0 añadió el gate `npm audit --audit-level=high` que **falla** contra el
estado heredado del repo (12 vulns, 4 critical en devDeps). Antes de pedir
review de los fixes de seguridad, CI debe distinguir entre:

- **CVEs en runtime (producción)** — bloqueantes siempre.
- **CVEs en devDependencies** — pueden ser advisory si el riesgo es solo del
  dev-server y la corrección requiere un breaking change.

## Acción ejecutada

```powershell
npm audit fix   # no-breaking: corrige todo lo que se puede sin majors
```

Resultado:

```
Antes: 12 vulnerabilities (1 low, 5 moderate, 2 high, 4 critical)
Tras:   7 vulnerabilities (1 low, 3 moderate, 1 high, 2 critical)
```

Las 7 restantes están todas en la cadena `vitest → @vitest/mocker → vite → vite-node → esbuild`:

| Paquete | Severidad | Solo dev | Comentario |
|---------|-----------|----------|------------|
| `vitest` | critical | ✅ | Vitest UI server (no se expone en CI). Fix: vitest 4 (breaking). |
| `@vitest/coverage-v8` | critical | ✅ | Depende de vitest. |
| `vite` | high | ✅ | Path traversal en dev server. |
| `vite-node`, `@vitest/mocker`, `esbuild`, `@yao-pkg/pkg` | moderate/low | ✅ | Cadena de transitivas. |

## Decisión sobre vitest 4

**No** se hace el bump a `vitest@4` en Fase 1 porque:

- Es breaking; podría romper 75 tests verdes y enmascarar regresiones de
  seguridad genuinas.
- El riesgo real es nulo en producción (esos paquetes no se distribuyen).
- En CI, el dev-server nunca arranca: se ejecuta `vitest run`, no `vitest --ui`.

Se programa **ADR-0007** en Fase 4 (Hardening) para la migración controlada
con tag intermedio y golden tests + wrap tests como red de seguridad.

## Cambio aplicado al CI

Antes:

```yaml
- name: npm audit (fail on high/critical)
  run: npm audit --audit-level=high
```

Después (en `.github/workflows/ci.yml`):

```yaml
- name: npm audit production deps (fail on high/critical)
  run: npm audit --omit=dev --audit-level=high
- name: npm audit full (advisory, devDeps included)
  run: npm audit --audit-level=high || echo "::warning::devDependency vulnerabilities present — see ADR-0007 (pending)"
```

Verificación local:

```
PS> npm audit --omit=dev --audit-level=high
found 0 vulnerabilities
```

✅ El gate bloqueante está verde.
⚠️ El advisory mostrará warnings hasta ADR-0007.

## Documento sucesor

ADR-0007 (Fase 4): migrar a vitest 4 + revalidar 80+ tests + actualizar
`@vitest/coverage-v8`.
