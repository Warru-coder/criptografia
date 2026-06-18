# ADR-0009: `picomatch` en lugar de regex artesanal para exclusiones

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 2

## Contexto

Hallazgo MED-02: `isExcluded()` en `src/filesystem/fileScanner.ts` traducía patrones glob (`'C:\\Program Files (x86)\\**'`) a regex con `.replace(/\*\*/g, '.*')`. La traducción:

1. No escapaba metacaracteres regex como paréntesis → patrones con `(x86)` se interpretaban como grupos de captura, alterando la semántica.
2. Riesgo teórico de ReDoS por catastrophic backtracking en rutas largas.
3. Mantenimiento frágil — cualquier patrón nuevo con `[`, `(`, `+`, `?`, `|` rompe sutilmente.

## Decisión

Usar **picomatch** (`npm` lib estándar, ya presente como transitive dependency) para compilar cada patrón a un matcher robusto:

```ts
const EXCLUSION_MATCHERS = SYSTEM_EXCLUSIONS.map((p) =>
  picomatch(p.replace(/\\/g, '/'), { nocase: true, dot: true }),
);
export function isExcluded(filePath: string): boolean {
  const candidate = filePath.replace(/\\/g, '/');
  return EXCLUSION_MATCHERS.some((m) => m(candidate));
}
```

## Consecuencias

- **Positivas:**
  - Semántica glob correcta y bien testeada.
  - Soporta `**`, `*`, `?`, brace expansion `{a,b}`.
  - Inmune al bug de paréntesis.
- **Negativas:** ninguna — `picomatch` ya está en `node_modules` (vía `chokidar`/etc.).
- **Migración:** ninguna — los patrones existentes se aceptan tal cual (con la normalización backslash→slash).

## Verificación

- [ ] Tests existentes de `fileScanner` siguen pasando.
- [ ] Caso de prueba específico: `'C:\\Program Files (x86)\\foo.exe'` se reconoce como excluido.

## Referencias

- MED-02 en informe.
- picomatch — https://github.com/micromatch/picomatch
