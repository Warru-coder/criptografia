# ADR-0005: Validar `SERVER_SECRET` incondicionalmente y derivar el KEK con HKDF

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Decisor(es):** Auditoría de seguridad (Fase 1)
- **Supersedes:** —
- **Fase de remediación:** 1

## Contexto

Hallazgos CRIT-03 y CRIT-04 de la auditoría:

- `wrapMasterKey()` (`src/web/routes/webauthnRoutes.ts`) construía la clave AES-256 como
  `Buffer.from(env.serverSecret.padEnd(32, '0').slice(0, 32))`. Si `SERVER_SECRET` estaba
  vacío o tenía <32 caracteres, la KEK era de baja entropía (en el peor caso, 32 bytes
  ASCII `'0'` ≡ 0x30).
- La validación de `SERVER_SECRET` solo se aplicaba en `NODE_ENV=production`. En
  desarrollo o tests sin la variable, WebAuthn registraba `wrappedKey` con KEK
  prácticamente fija → cualquiera con la DB SQLite podía recuperar la masterKey de
  todos los usuarios sin contraseña.

## Decisión

1. **Validar `SERVER_SECRET` incondicionalmente cuando `ENABLE_WEBAUTHN=true`**.
   El servidor aborta el arranque (`process.exit(1)`) si falta o si su longitud es
   <32 caracteres, **independientemente de `NODE_ENV`**.
2. **Derivar la KEK con HKDF-SHA256** sobre `SERVER_SECRET` con `info` explícito
   (`"SecureCrypt-v2-webauthn-wrap-key"`) y `salt` vacío. RFC 5869.
3. **Versionar el formato de la blob envuelta** con un byte prefijo (`0x02`).
   Las blobs v1 (anteriores al fix) se rechazan con un mensaje claro indicando al
   usuario que debe re-vincular su passkey vía login con contraseña.

## Opciones consideradas

### Opción A — HKDF-SHA256 (elegida)
- ✅ Estándar RFC 5869; soportado nativamente por Node ≥ 15 (`crypto.hkdfSync`).
- ✅ Separación de dominio explícita vía `info` (permite añadir otras KEKs en el
  futuro sin colisiones).
- ✅ Determinista — el mismo `SERVER_SECRET` produce el mismo KEK.
- ❌ Sigue dependiendo de `SERVER_SECRET` ⇒ la decisión final del modelo de confianza
  se aborda en ADR-008 (WebAuthn PRF).

### Opción B — SHA-256 directo
- ✅ Trivial.
- ❌ Sin separación de dominio: si en el futuro derivamos otro propósito del mismo
  secreto, ambos serían idénticos.

### Opción C — Estado actual (padEnd)
- ❌ Rechazada: ver CRIT-03/CRIT-04.

## Consecuencias

- **Positivas:**
  - KEK de 256 bits con entropía equivalente al `SERVER_SECRET` (≥ 32 bytes obligatorio).
  - Imposible arrancar el servidor con WebAuthn habilitado sin un secreto correcto.
  - Migración explícita y verificable: blobs v1 se rechazan, no se descifran con KEK
    incorrecta silenciosamente.
- **Negativas / coste:**
  - Usuarios con passkey registrada antes del fix deben **re-vincularla** logueándose
    con contraseña (re-genera `wrappedKey` v2).
  - CI debe definir `SERVER_SECRET` (ya lo hacía: `ci-secret-32-chars-padded-xxxxxxx`).
- **Migración:**
  - El propio `unwrapMasterKey` lanza un error explicativo si encuentra v1.
  - Los tests añadidos validan rechazo de v1 y roundtrip v2.

## Verificación

- [x] Tests: `tests/unit/session/wrapKey.test.ts` (8/8) — roundtrip, dominio,
  versioning, secreto incorrecto.
- [x] Tests integración: `tests/integration/auth.test.ts` siguen pasando (11/11).
- [x] Modelo de amenaza actualizado: STRIDE → I/E en WebAuthn ya no es trivial
  ante compromiso de DB *solo* (sigue siendo posible si se compromete también el
  `SERVER_SECRET` — ADR-008 lo resolverá).

## Referencias

- CRIT-03, CRIT-04 en `auditoria_fase0/` y informe de auditoría.
- RFC 5869 — HKDF.
- NIST SP 800-108 — Key derivation.
- ADR-008 (futuro) — WebAuthn PRF / hmac-secret.
