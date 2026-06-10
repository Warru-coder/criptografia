# ADR-001: Unificación de KDF a Argon2id en todas las plataformas

**Estado**: Propuesto  
**Fecha**: Junio 2026  
**Decisores**: Gabriel (autor del TFM)

---

## Contexto

Las tres plataformas de SecureCrypt usan diferentes KDFs:
- Node.js: Argon2id (correcto)
- Windows C++: loop SHA-256 × 100 iteraciones (muy débil)
- Android: PBKDF2-HMAC-SHA256 × 30.000 iteraciones (aceptable pero no Argon2id)

Además, la documentación afirma falsamente que las tres usan Argon2id. Los archivos cifrados no son interoperables entre plataformas.

## Decisión

Adoptar **Argon2id** como único KDF para las tres plataformas:
- Node.js: mantener la implementación actual (paquete `argon2`)
- Windows C++: integrar **libsodium** (`crypto_pwhash` = Argon2id)
- Android: usar **BouncyCastle** o la implementación de Android Argon2 API 34+

## Consecuencias Positivas
- Interoperabilidad de archivos entre plataformas
- Documentación honesta y verificable
- Seguridad uniforme (todos al nivel de Argon2id OWASP)
- Un único set de parámetros para auditar

## Consecuencias Negativas
- Archivos cifrados con v0.3.0 en Windows/Android no son compatibles con v0.4.0
  - **Mitigación**: introducir campo de versión en el header, migración documentada
- Compilar libsodium en Windows con MSVC puede requerir vcpkg o compilación manual
  - **Mitigación alternativa**: usar `BCryptDeriveKeyPBKDF2` de CNG con 600.000 iteraciones como paso intermedio

## Alternativas Rechazadas
- Mantener KDFs distintos: genera deuda técnica permanente y documentación engañosa
- Adoptar PBKDF2 uniformemente: Argon2id es más resistente a GPU attacks, mejor elección para 2026+

## Implementación
Ver [Security Audit](../security/security-audit.md) SEC-002 para los detalles de implementación.
