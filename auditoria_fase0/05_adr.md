# 0.5 — Plantilla ADR y convención

## Por qué

Las Fases 1–4 implican decisiones arquitectónicas con trade-offs reales:

- ¿Argon2id (libsodium) o PBKDF2 real (BCrypt) en Windows?
- ¿Cookie HttpOnly o seguir con Bearer + nonce CSP?
- ¿WebAuthn PRF o aceptar el modelo "trust the server"?

Sin **ADR (Architecture Decision Record)**, en 6 meses nadie recordará por qué se eligió A en lugar de B, y un mantenedor futuro puede deshacer la decisión sin entender las implicaciones.

## Convención

- Ubicación: `docs/decisions/NNNN-titulo-kebab-case.md`.
- Numeración secuencial: `0001`, `0002`, ...
- **Inmutables una vez aceptados**. Para revertir → nuevo ADR con `Supersedes: ADR-NNNN`.
- Estados: `Propuesto` → `Aceptado` → `Deprecado` / `Supersedido`.

## ADRs ya existentes (pre-auditoría)

| # | Título | Estado |
|---|--------|--------|
| 001 | KDF Unification | Existente |
| 002 | Session Auth | Existente |

## ADRs que deben crearse durante la remediación

| Fase | # propuesto | Tema |
|------|-------------|------|
| 1 | 003 | Reemplazo de DeriveKey roto en C++ por libsodium Argon2id |
| 1 | 004 | Streaming AES-GCM via crypto_secretstream vs chunked manual |
| 1 | 005 | Validación de SERVER_SECRET ≥ 32 B raw en arranque |
| 2 | 006 | HKDF-SHA256 para file-key, eliminar Argon2id doble |
| 2 | 007 | Eliminación de `master.hash` redundante |
| 3 | 008 | WebAuthn PRF / hmac-secret como KEK del wrap |
| 3 | 009 | Migración Bearer → Cookie HttpOnly + CSRF doble-submit |
| 4 | 010 | Política de cabeceras HTTP (helmet COEP/COOP/CORP) |

## Plantilla creada

`docs/decisions/0000-template.md` — copiar para cada ADR nuevo.
