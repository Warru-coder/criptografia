# ADR-0007: HKDF-SHA256 para derivar file-keys (no más Argon2id-sobre-clave)

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 2

## Contexto

Hallazgo ALTA-01: `fileCipher.ts` y `fileDecipher.ts` derivaban la clave de cifrado de cada fichero ejecutando **Argon2id sobre `masterKey.toString('base64')`**. La masterKey ya tiene 256 bits de entropía: pasarla como "password" a Argon2id es un error de categoría — Argon2id está diseñado para inputs de baja entropía (passwords humanos), no para material ya aleatorio. El coste de 200+ms por operación ralentiza al usuario sin aportar seguridad real.

## Decisión

Sustituir `deriveFileKey(masterKey.toString('base64'), salt)` por **HKDF-SHA256** (RFC 5869):

```ts
const FILE_KEY_INFO = Buffer.from('SecureCrypt-v2-file-key');
function deriveFileKeyHKDF(masterKey: Buffer, salt: Buffer): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, salt, FILE_KEY_INFO, 32));
}
```

- `salt` = el salt aleatorio del fichero (ya estaba en la cabecera).
- `info` = separador de dominio para distinguir esta KEK de futuras (`'SecureCrypt-v2-wrap-key'`, etc.).

Bump del byte de versión en la cabecera `.scrypt`: **v1 → v2**.
- v1 = legacy (Argon2id-over-key). El decryptor sigue soportándolo (compat).
- v2 = HKDF-SHA256 (todo nuevo cifrado).

## Consecuencias

- **Positivas:**
  - Encryption/decryption pasa de ~200ms a ~µs por fichero (HKDF es una operación de hash).
  - Modelo criptográfico coherente: Argon2id solo para passwords humanos.
  - Domain separation explícita: distintas KEKs no colisionan.
- **Negativas / migración:**
  - Ficheros v1 existentes siguen siendo legibles (rama `Argon2id` en decryptFile detectada por `header.version === 1`).
  - El golden test v1 sigue funcionando como **test de lectura legacy**.

## Verificación

- [x] Test nuevo (en `tests/regression/format-v1-scrypt.test.ts`):
  - Cabecera escribe version=2.
  - Roundtrip v2 OK.
  - Decrypt rechaza con masterKey incorrecta.
  - Decrypt detecta tampering de 1 byte.
- [x] Test legacy v1: construye manualmente cabecera v1 + Argon2id KDF, verifica que decryptFile lo descifra.

## Referencias

- RFC 5869 (HKDF).
- NIST SP 800-108 (KDF).
- ALTA-01 en informe de auditoría.
