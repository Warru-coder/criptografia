# ADR-0012: Plan de deprecación de `master.hash` (camino a single-source-of-truth)

- **Estado:** Aceptado (plan); implementación diferida a Fase 3
- **Fecha:** 2026-06-18
- **Fase:** 2 (planning), 3 (execution)

## Contexto

Hallazgo ALTA-02: cada usuario tiene **dos** artefactos derivados de su contraseña:

- `users.passwordHash` + `users.salt` en SQLite — usados por `verifyMasterPassword()`.
- `~/.securecrypt/users/{id}/vault/master.hash` (JSON) — contiene Argon2id hash + un salt **distinto**, usado por `getMasterKey()` para derivar la masterKey raw de 32 B.

Defensa en profundidad: la DB sirve para autenticar (verify) y el vault para derivar la masterKey. Pero el coste es:

- Dos superficies para mantener consistentes ante cambio de password.
- Robo del vault file revela parámetros independientes del de la DB.
- Lógica duplicada en `secureStorage.ts`.

## Análisis: ¿es realmente un bug?

El uso de salts independientes para verify-hash vs. KDF-key **no es inseguro**; es defensa en profundidad clásica. El hallazgo ALTA-02 lo califica como alta más por:

1. Mantenimiento (duplicación).
2. Riesgo operativo (cambio de password incompleto si una de las dos escrituras falla).
3. Falta de migración entre formatos (¿qué pasa si Fase 2 quiere bump del schema?).

## Decisión

**Fase 2 (ahora):** no se modifica el comportamiento. Se documenta el plan.

**Fase 3 (próxima):** consolidar a **single source of truth = DB**.

Plan de migración Fase 3:

1. Añadir columna `users.masterSalt TEXT` (idempotente, ALTER TABLE).
2. Al primer login después del bump, si `users.masterSalt IS NULL` y existe `master.hash`:
   - Leer salt del fichero, escribir a DB.
   - Conservar `master.hash` como respaldo durante 1 release.
3. A partir de Fase 3, `getMasterKey` lee `masterSalt` de DB; `master.hash` queda solo como compat.
4. Fase 4: eliminar `master.hash` por completo. Endpoint de cambio de password (MED-04) regenera ambos salts de forma atómica.

## Consecuencias

- **Positivas (futuras):**
  - Atomicidad: cambio de password = una transacción SQL.
  - Backups más simples (solo DB).
  - Menos formatos que mantener.
- **Negativas:**
  - Schema migration tiene riesgo: requiere transacción + verificación post-migración.
  - Se acepta que Fase 2 mantiene el dual-store por ahora.

## Verificación (cuando se implemente en Fase 3)

- [ ] Test de migración: DB sin `masterSalt` + `master.hash` existente → primer login crea columna y propaga.
- [ ] Test de no-migración: DB con `masterSalt` existente → ignora `master.hash`.
- [ ] Test de fallback: `master.hash` corrupto → migración falla con error legible (no destrucción de DB).

## Referencias

- ALTA-02 en informe.
- MED-04 (cambio de password) — fase 3.
