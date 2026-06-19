# ADR-0015: Plan para WebAuthn PRF / hmac-secret (eliminar trust-the-server)

- **Estado:** Aceptado (plan); implementación parcial en Fase 3 (server scaffolding) + completa en Fase 4
- **Fecha:** 2026-06-18

## Contexto

Hallazgo ALTA-06: el modelo de confianza de WebAuthn en SecureCrypt es
"trust-the-server": tras vincular una passkey, la masterKey del usuario se
almacena envuelta con una KEK derivada del `SERVER_SECRET` (ADR-0005). Esto
significa que **el compromiso del servidor permite recuperar la masterKey
de cualquier usuario con passkey** sin necesidad de la contraseña ni del
autenticador. Contradice la promesa de cifrado del producto.

## Decisión

Migrar a **WebAuthn PRF extension** (alias `hmac-secret` a bajo nivel):

- El autenticador (Yubikey, Touch ID, Windows Hello con TPM, etc.) computa
  `HMAC(authenticatorSecret, prfSalt)` y devuelve el resultado al cliente.
- El cliente deriva la KEK del wrap **a partir de ese output** (HKDF-SHA256).
- El servidor **nunca ve** el output del PRF en el caso ideal (wrap/unwrap
  client-side). Si por restricciones técnicas el unwrap se hace server-side
  durante el login, el output transita pero no se persiste.

Tras la migración, comprometer el servidor (DB + SERVER_SECRET) ya **no
basta** para recuperar masterKeys: hace falta el autenticador físico del
usuario.

## Implementación por iteraciones

### Fase 3 — Server scaffolding (en este commit)

- `webauthn_credentials.prfSalt TEXT` — columna nueva (ALTER TABLE
  idempotente). Guarda el salt aleatorio que se pasa al autenticador en
  cada operación PRF.
- `users.wrappedKeyVersion INTEGER` — distingue v2 (HKDF/SERVER_SECRET) y
  v3 (PRF-derived KEK).
- Stub en `webauthnRoutes`: campos preparados para emitir la extensión
  `prf: { eval: { first: prfSalt } }` y aceptar el output en login.

### Fase 4 — Client + cierre

- `public/js/app.js`: detectar soporte PRF (`navigator.credentials.create`
  con `extensions: { prf: ... }`), pedir output durante registro y login.
- Derivar KEK con WebCrypto (`HKDF`) en el navegador.
- Wrap/unwrap **client-side** de la masterKey (la masterKey vive en JS
  durante la sesión activa; ya lo hacía antes, no es regresión).
- Migración: los wrappedKey v2 existentes se mantienen como fallback;
  durante la próxima auth con passkey se ofrece "upgrade a PRF".

## Trade-offs

- **PRF no es universal**: pasa por autenticadores con `hmac-secret`. Windows
  Hello + TPM 2.0 lo soportan; algunas YubiKey sí; iCloud Keychain depende
  de la versión. Si el autenticador del usuario no soporta PRF, **fallback
  graceful** al wrap v2 con aviso explícito.
- **Cliente como gatekeeper de seguridad**: el navegador hace HKDF;
  cualquier bug ahí es ruta de fuga. Aceptable porque ya manejaba la
  masterKey en memoria JS antes (no se introduce nueva superficie).

## Verificación

- [ ] DB migration test: usuario existente abre la DB en versión nueva → no
  rompe; columnas `prfSalt` y `wrappedKeyVersion` aparecen como NULL.
- [ ] (Fase 4) Test e2e con WebAuthn virtual authenticator que soporta PRF.
- [ ] (Fase 4) Threat model actualizado: compromiso del servidor + DB no
  recupera masterKeys de usuarios con passkey v3.

## Referencias

- ALTA-06 en informe.
- W3C WebAuthn Level 3 — PRF extension.
- CTAP2 hmac-secret.
- libsodium `crypto_kdf_hkdf_sha256`.
