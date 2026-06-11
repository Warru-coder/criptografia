# Security Policy

## Versiones soportadas

| Versión | Soporte de seguridad |
|---------|---------------------|
| 0.3.x   | Activa — recibe parches |
| < 0.3   | Sin soporte |

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Las vulnerabilidades deben reportarse por email a:

**gabideltoya@gmail.com**

Incluye en el reporte:
- Descripción del problema y componente afectado
- Pasos para reproducirlo (PoC mínimo si es posible)
- Impacto estimado (confidencialidad, integridad, disponibilidad)
- Tu nombre o alias para el crédito (opcional)

Respuesta esperada en 72 horas. Divulgación coordinada tras publicar el parche.

## Qué está en scope

- **Núcleo criptográfico** (`src/crypto/`): cifrado AES-256-GCM, derivación de claves Argon2id, verificación del auth tag
- **API web** (`src/web/routes/`): endpoints de autenticación, gestión de sesiones, rutas protegidas
- **Protección path traversal** (`src/web/middleware/pathSandbox.ts`): escape del directorio de datos
- **Gestión de sesiones** (`src/web/session/sessionStore.ts`): tokens, TTL, limpieza de claves en memoria
- **WebAuthn** (`src/web/routes/webauthnRoutes.ts`): registro y autenticación con passkeys FIDO2

## Qué está fuera de scope

- Vulnerabilidades del sistema operativo anfitrión o del kernel
- Dependencias de terceros (reportar directamente al proyecto upstream)
- Ataques que requieren acceso físico a la máquina o acceso root/admin previo
- Problemas de denegación de servicio por recursos de hardware insuficientes
- La app Windows C++ (`criptografia-app-windows/`) en su estado actual (parcial)

## Estándares aplicados

- **AES-256-GCM**: cifrado autenticado, auth tag de 128 bits verificado antes de devolver datos
- **Argon2id RFC 9106**: KDF memory-hard con parámetros OWASP (memoryCost ≥ 19.456 KB, timeCost ≥ 2)
- **WebAuthn / FIDO2**: W3C WebAuthn Level 2, passkeys vinculadas al origen, resistentes a phishing
- **Tokens de sesión**: 256 bits de entropía (`crypto.randomBytes(32)`), TTL deslizante, limpieza con `fill(0)`
- **Rate limiting**: 10 intentos/15 min en `/api/auth/`, 100 req/15 min en API general

## Limitaciones conocidas

- **Clave maestra en memoria durante la sesión**: la clave AES-256 reside en un `Map` en RAM mientras la sesión está activa. Un atacante con capacidad de volcar la memoria del proceso podría extraerla. Mitigación: TTL de sesión configurable (default 30 min), `fill(0)` al expirar o hacer logout.
- **Incompatibilidad de formato entre plataformas**: la app web usa Argon2id; la app Windows C++ usa PBKDF2-HMAC-SHA256 (limitación de Windows BCrypt). Los archivos `.scrypt` generados por una plataforma no son descifables por la otra. Documentado en ADR-003; unificación con libsodium planificada.
