# ADR-0011: Política de contraseñas NIST SP 800-63B

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 2

## Contexto

Hallazgo ALTA-08: `passwordValidator.ts` exigía composición clásica (mayúscula, minúscula, dígito, símbolo) con mínimo 8 caracteres y una blocklist de **5 entradas**. Esto:

- Contradice NIST SP 800-63B 2017 y OWASP 2024, que **desaconsejan explícitamente** las reglas de composición porque empujan al usuario a sustituciones predecibles (`Password1!`, `Admin2024@`).
- 8 caracteres es insuficiente para proteger material criptográfico.
- Blocklist trivialmente bypaseable.

## Decisión

Reescribir `validatePassword()` con criterios NIST 800-63B:

- **Mínimo 12 caracteres** (apropiado para passwords que protegen un vault criptográfico).
- **Eliminadas** reglas obligatorias de composición.
- **Blocklist ampliada** (40+ entradas de OWASP/HIBP top + variantes SecureCrypt).
- **Detección de patrones débiles:** ≥4 caracteres idénticos en serie (`aaaa`), runs secuenciales ≥5 (`12345`, `qwerty`).
- **Score por entropía de Shannon** (0..7) en lugar de heurística de composición.

Sin dependencia nueva (no `zxcvbn`, no HIBP) en Fase 2. Esos se programan para Fase 4 (ADR pendiente).

## Consecuencias

- **Positivas:**
  - Aceptamos passphrases como `correct horse battery staple` (recomendado por XKCD/NIST).
  - Rechazamos `Password1!`, `Admin@2024`, `Qwerty12345!`.
  - Score por entropía es más honesto que sumar puntos por categoría.
- **Negativas:**
  - Tests existentes de `passwordValidator` reescritos.
  - Tests de integración: `'Str0ng!Pass#2024'` (16 chars) sigue siendo válido — no se necesita actualizar.

## Migración

- Los usuarios existentes con passwords de 8-11 caracteres siguen pudiendo loguearse (no se re-valida en login).
- Los usuarios nuevos / cambios de password deben cumplir la nueva política.
- En Fase 4 (HIBP + zxcvbn) se podría forzar revalidación al siguiente login.

## Verificación

- [x] `tests/unit/passwordManager/passwordValidator.test.ts` reescrito (8 tests).
- [x] Auth integration tests siguen verde (passwords usan ≥16 chars).

## Referencias

- NIST SP 800-63B § 5.1.1.2 — Memorized Secret Verifiers.
- OWASP Authentication Cheat Sheet 2024.
- ALTA-08 en informe.
