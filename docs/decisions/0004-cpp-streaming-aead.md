# ADR-0004: Streaming AEAD correcto en C++ (chunked AES-GCM con nonce por chunk)

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase de remediación:** 1

## Contexto

Hallazgo CRIT-02: `CryptoEngine::EncryptFile`/`DecryptFile`
(`apps/windows/src/core/crypto/CryptoEngine.cpp`) implementa el streaming AES-GCM
de forma **catastrófica**:

1. Reutiliza el **mismo IV** en cada llamada a `BCryptEncrypt` dentro del bucle
   (nonce reuse en GCM con misma clave ⇒ recuperación de plaintext + clave H).
2. No usa `BCRYPT_AUTH_MODE_CHAIN_CALLS_FLAG` ni mantiene `pbMacContext`/`cbMacContext`
   entre bloques ⇒ el tag final no autentica el archivo completo.
3. El tag "extraído" del último bloque (línea 295-299) **no corresponde** al GCM
   acumulado del fichero — se copia directamente del buffer cifrado, lo que
   es semánticamente incorrecto.

Resultado: ficheros >64 KiB cifrados con esta ruta son **inseguros** en
confidencialidad e integridad.

## Decisión

Reemplazar el streaming actual por **chunked AEAD** con la siguiente estructura:

- Cada chunk: 64 KiB de plaintext.
- Cada chunk se cifra **de forma independiente** con:
  - Una **nonce derivada**: `nonce_prefix(8 B random, fijo por fichero) || counter(4 B, LE, por chunk)`.
  - Tag GCM de 16 B **por chunk**.
- Formato del chunk en disco: `[length(4B LE)] [ciphertext(N)] [tag(16B)]`.
- Cabecera del fichero v2 incluye:
  - MAGIC, VERSION=2.
  - `nonce_prefix` de 8 B.
  - Salt 16 B, IV-base (ya no se usa para GCM directamente, se mantiene por compat con migration).
  - Argon2 params (o flag indicando PBKDF2 v2 de ADR-0003).
- El último chunk lleva una marca explícita (length con bit alto a 1, p. ej.).

## Opciones consideradas

### Opción A — Chunked AEAD propio (elegida)
- ✅ Cero dependencias nuevas; usa solo CNG.
- ✅ Permite descifrado streaming sin cargar todo en memoria.
- ✅ Cada chunk es individualmente autenticado: tampering del chunk N solo afecta
  al descifrado de ese chunk y posteriores.
- ❌ Requiere diseñar el framing con cuidado (off-by-one, truncation attacks).

### Opción B — Buffer completo en memoria + un solo GCM
- ✅ Trivial.
- ❌ Limita el tamaño máximo de archivo a la RAM disponible.
- ❌ Pico de memoria 2× tamaño de fichero.

### Opción C — libsodium `crypto_secretstream_xchacha20poly1305`
- ✅ Diseño battle-tested (Signal, age, etc.).
- ✅ Manejo correcto de truncation/reorder por construcción (chunk tags encadenados).
- ❌ Introduce dependencia (vcpkg/vendoring).
- ⏳ **Recomendado para Fase 2 / ADR-001** (unificación cross-platform).

### Opción D — `BCRYPT_AUTH_MODE_CHAIN_CALLS_FLAG` correcto
- ✅ Mantiene un solo tag de fichero (más estándar).
- ❌ API CNG compleja, fácil de implementar mal otra vez; la documentación oficial
  es ambigua. Más superficie de error.

## Consecuencias

- **Positivas:**
  - Confidencialidad e integridad reales por chunk.
  - Streaming sin memoria O(N).
  - Detección de truncation (último chunk falta marca) y reorder (counter incremental).
- **Negativas:**
  - Formato `.scrypt` v2 incompatible con v1 de la rama C++ (que era inseguro de
    todas formas; aceptable).
  - Overhead de 20 B (length+tag) por cada 64 KiB → ~0.03% — despreciable.
- **Migración:**
  - Archivos v1 generados por la rama C++ rota se consideran no-recuperables
    (estado "parcial" según `SECURITY.md`).
  - Si hay archivos v1 que sí descifran (porque caben en un solo chunk de 64 KiB),
    el decryptor v2 puede ofrecer un modo legacy de un único `BCryptDecrypt`.

## Verificación

- [ ] Implementación: `CryptoEngine::EncryptFile`/`DecryptFile` reescritas.
- [ ] Test vector: fichero 100 MB → encrypt → modificar 1 byte en chunk 100 →
  decrypt falla con tag inválido en ese chunk; chunks anteriores se devuelven OK.
- [ ] Test de truncation: borrar el último chunk → decrypt falla con marca de fichero.
- [ ] Test cross-platform si en Fase 2 se unifica con libsodium.

## Referencias

- CRIT-02 en informe de auditoría.
- NIST SP 800-38D (GCM).
- AGE protocol — diseño de chunked AEAD.
- libsodium `crypto_secretstream` — referencia de diseño.
