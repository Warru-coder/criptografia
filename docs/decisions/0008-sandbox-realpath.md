# ADR-0008: Sandbox de paths con `realpath` (defensa contra symlinks)

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 2

## Contexto

Hallazgo MED-01: `sandboxPath()` en `src/web/middleware/pathSandbox.ts` solo aplicaba `path.resolve()` antes de comprobar que el path estuviera dentro de `BASE_DIR`. Esto solo normaliza la representación textual: si un atacante (o un proceso anterior) crea un symlink dentro de `dataDir` apuntando a `C:\Windows`, el check textual lo da por válido y la lectura escapa.

## Decisión

Aplicar `fs.realpathSync()` después de `path.resolve()`, antes del check del prefijo. Para paths inexistentes (caso típico: directorio de salida que se va a crear), recorrer hacia arriba hasta el primer ancestro existente, realpath-arlo, y reconstruir la cola.

```ts
function resolveRealPath(p: string): string {
  if (fs.existsSync(p)) return fs.realpathSync(p);
  // ... walk up to first existing ancestor, realpath it, re-append tail
}
```

## Consecuencias

- **Positivas:** symlinks dentro del sandbox que apunten fuera son rechazados.
- **Negativas:** llamada extra a `fs.realpathSync` por validación; despreciable.
- **Migración:** ninguna — comportamiento más estricto, no se rompe ningún flujo válido.

## Verificación

- [ ] Test manual: crear symlink `dataDir/escape → C:\Windows`, llamar
  `sandboxPath('escape')`, debe lanzar `ForbiddenPathError`.

## Referencias

- MED-01 en informe.
- CWE-59 (Improper Link Resolution Before File Access).
