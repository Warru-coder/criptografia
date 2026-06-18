# ADR-0003: Reemplazar la `DeriveKey` rota en C++ por PBKDF2-HMAC-SHA256 real

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase de remediación:** 1

## Contexto

Hallazgo CRIT-01: `CryptoEngine::DeriveKey` (`apps/windows/src/core/crypto/CryptoEngine.cpp`)
**no implementa PBKDF2 ni ninguna KDF iterativa real**. El bucle de
`CryptHashData` solo concatena datos al buffer del hash; la función SHA-256 se
ejecuta **una sola vez** al llamar a `CryptGetHashParam`. El coste para un
atacante es ~1 hash por candidato, no 600.000.

Esto invalida la promesa pública del README y de `SECURITY.md` ("PBKDF2-HMAC-SHA256
600.000 iteraciones"), y permite romper contraseñas a velocidad de hash crudo en
GPU (~8 GH/s para SHA-256 commodity).

## Decisión

Reemplazar `DeriveKey` por **`BCryptDeriveKeyPBKDF2`** (Windows CNG), con:

- Algoritmo de PRF: HMAC-SHA256 (handle abierto con `BCRYPT_ALG_HANDLE_HMAC_FLAG`).
- Iteraciones: **600.000** (OWASP 2024 para SHA-256).
- Salida: 32 bytes (AES-256 key).

La función presenta la misma firma pública (`DeriveKey(password, salt, length)`)
para no romper a sus callers (`KeyManager`).

## Opciones consideradas

### Opción A — BCryptDeriveKeyPBKDF2 (elegida)
- ✅ Disponible en Windows 7+ (CNG core).
- ✅ Sin nuevas dependencias externas.
- ✅ Implementación validada por Microsoft (FIPS 140-2).
- ❌ No es Argon2id → la unificación con la rama Node sigue siendo necesaria
  (ADR-001 pendiente).

### Opción B — libsodium `crypto_pwhash` (Argon2id)
- ✅ Unifica con la rama Node de un solo golpe.
- ✅ Memory-hard → mejor frente a ataques GPU/ASIC.
- ❌ Introduce dependencia externa (vcpkg o vendoring) → trabajo de build/CI no
  trivial dentro de la Fase 1.
- ⏳ Se programa como **Fase 2/ADR-001** (ya planificado en el roadmap original).

### Opción C — Status quo (DeriveKey roto)
- ❌ Rechazada: rompe la promesa criptográfica del producto.

## Consecuencias

- **Positivas:**
  - Coste real de 600.000 iteraciones HMAC-SHA256 por intento → ataque offline
    a 8 caracteres alfanuméricos ya no es práctico en horas.
  - El `SECURITY.md` deja de mentir.
- **Negativas:**
  - Sigue siendo PBKDF2 (no memory-hard) → menos resistente a GPU que Argon2id.
    Aceptable como fix intermedio; Fase 2 unificará a Argon2id.
  - **Rotura de compatibilidad con archivos cifrados por la app Windows**
    previa al fix: como el KDF cambia, archivos creados con el `DeriveKey` falso
    no se descifrarán con el nuevo. **Mitigación**: la app Windows estaba en
    estado "parcial" (declarado en `SECURITY.md`) y, según contexto del proyecto,
    no había usuarios reales. Se documenta como `BREAKING` para v0.4.0.

## Migración

- Bump de versión en cabecera de fichero de v1 (legacy) a v2 (PBKDF2 real).
- Decryptor detecta versión y elige KDF:
  - v1 → intentar con el `DeriveKey` falso (modo "legacy migration"), advertir al
    usuario, re-cifrar con v2.
  - v2 → PBKDF2-HMAC-SHA256 600.000 iter.

## Verificación

- [x] Implementación creada: `CryptoEngine::DeriveKey` reescrita.
- [ ] Test vector OWASP PBKDF2 (password="password", salt="salt", iter=N, ...) — pendiente de build env.
- [ ] Test cross-platform: clave derivada en C++ debe igualar a la derivada en Node
  con los mismos parámetros (sanity check).
- [ ] Documentar en `SECURITY.md` que los parámetros son v2.

## Referencias

- CRIT-01 en informe de auditoría.
- OWASP Password Storage Cheat Sheet 2024.
- RFC 8018 (PBKDF2).
- Microsoft Docs: `BCryptDeriveKeyPBKDF2`.
