# ADR-NNNN: Título corto e imperativo

- **Estado:** Propuesto | Aceptado | Deprecado | Supersedido por ADR-XXXX
- **Fecha:** YYYY-MM-DD
- **Decisor(es):** Nombre / equipo
- **Supersedes:** (vacío) | ADR-NNNN
- **Fase de remediación:** 0 | 1 | 2 | 3 | 4 | 5

## Contexto

Qué problema técnico o de seguridad obliga a tomar una decisión. Citar evidencia: número de hallazgo de auditoría (CRIT-01, ALTA-03, etc.), CVE, ticket, métricas.

## Decisión

La opción elegida en una frase, sin matices. Ej:
> Reemplazar `CryptoEngine::DeriveKey` por `crypto_pwhash` de libsodium (Argon2id), eliminando la implementación basada en `CryptHashData` iterado.

## Opciones consideradas

### Opción A — \<nombre\>
- ✅ Ventajas
- ❌ Desventajas

### Opción B — \<nombre\>
- ✅ Ventajas
- ❌ Desventajas

### Opción C — Status quo
- ✅
- ❌

## Consecuencias

- **Positivas:** qué mejora (cuantificado si es posible).
- **Negativas / coste:** qué se pierde, qué deuda técnica nueva aparece.
- **Migración:** plan de migración si afecta a usuarios existentes (golden tests, formato de fichero, etc.).
- **Reversibilidad:** ¿es fácil deshacer en N semanas? ¿qué bloqueamos al elegir esta opción?

## Verificación

- [ ] Tests añadidos: ...
- [ ] Threat model actualizado: ...
- [ ] Documentación: ...
- [ ] Métricas post-implementación: ...

## Referencias

- RFC, NIST SP, OWASP, CWE, etc.
- PRs, commits, issues relacionados.
