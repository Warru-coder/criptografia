# Capítulo 7: Análisis de Seguridad

## 7.1 Metodología

El análisis de seguridad siguió el proceso OWASP Testing Guide v4.2, adaptado al contexto del proyecto:

1. **Análisis estático**: revisión manual del código fuente
2. **Modelado de amenazas**: STRIDE por componente
3. **Revisión de dependencias**: npm audit
4. **Tests de penetración manuales**: 10 vectores de ataque
5. **Análisis CVSS 3.1**: puntuación cuantitativa de cada hallazgo

## 7.2 Hallazgos identificados y corregidos

### SEC-001 — Path Traversal en encrypt/decrypt-dir (CVSS 8.1 - HIGH)

**Descripción**: El endpoint `POST /api/encrypt-dir` aceptaba rutas arbitrarias del cliente sin validación, permitiendo cifrar o descifrar cualquier directorio del sistema donde el proceso Node.js tuviera permisos de lectura.

**PoC**:
```http
POST /api/encrypt-dir HTTP/1.1
Authorization: Bearer <valid-token>

{"inputPath": "../../etc/passwd", "outputPath": "/tmp/exfil"}
```

**Impacto**: Exfiltración de datos, corrupción de archivos del sistema.

**Corrección implementada**:
```typescript
// src/web/middleware/pathSandbox.ts
const BASE_DIR = path.resolve(process.env.SECURECRYPT_BASE_DIR ?? os.homedir());

export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  if (resolved !== BASE_DIR && !resolved.startsWith(BASE_DIR + path.sep)) {
    throw new ForbiddenPathError(`Path outside sandbox: ${userInput}`);
  }
  return resolved;
}
```

**Estado**: Corregido en Fase 0.

---

### SEC-002 — Contraseña en cuerpo de cada request (CVSS 7.3 - HIGH)

**Descripción**: La versión original enviaba la contraseña maestra en el cuerpo de cada request de cifrado/descifrado. La contraseña podía quedar expuesta en logs del servidor, proxies de red o memoria del proceso.

**PoC**: Cualquier request a `/api/encrypt` contenía `password: "micontraseña"` en el JSON.

**Corrección implementada**:
- Sistema de sesiones con tokens de 256-bit (authRoutes.ts + sessionStore.ts)
- La contraseña solo se envía UNA VEZ en `POST /api/auth/login`
- Todos los demás requests usan `Authorization: Bearer <token>`
- La clave maestra se almacena en memoria del servidor (SessionStore), no en el cliente

**Estado**: Corregido en Fase 0.

---

### SEC-003 — Timing Attack en verificación de contraseña (CVSS 5.9 - MEDIUM)

**Descripción**: La función `verifyMasterPassword` en la app Windows (C++) usaba comparación de cadenas estándar (`==`), que es susceptible a timing attacks porque cortocircuita en el primer byte diferente.

**PoC**:
```cpp
// VULNERABLE: tiempo de ejecución varía con longitud del prefijo correcto
if (storedHash == computedHash) { ... }
```

**Corrección implementada**:
```cpp
// src (apps/windows): ConstantTimeEqual
bool KeyManager::ConstantTimeEqual(
  const std::vector<BYTE>& a, const std::vector<BYTE>& b) {
  if (a.size() != b.size()) return false;
  BYTE diff = 0;
  for (size_t i = 0; i < a.size(); i++) {
    diff |= a[i] ^ b[i]; // XOR-fold: sin cortocircuito
  }
  return diff == 0;
}
```

**Nota**: En el backend Node.js, `argon2.verify()` ya usa comparación en tiempo constante internamente.

**Estado**: Corregido en Fase 0.

---

### SEC-004 — Salt fijo en HashPassword C++ (CVSS 8.8 - HIGH)

**Descripción**: La función original `HashPassword()` generaba un nuevo salt aleatorio en cada llamada y no lo almacenaba. Esto hacía imposible verificar la contraseña (el hash nunca coincidía) y fue "solucionado" con un salt hardcoded, creando una vulnerabilidad mayor.

**Impacto**: Con salt fijo, un atacante puede precomputar tablas rainbow para ese salt específico.

**Corrección implementada**:
- `HashPasswordWithSalt(password, salt)` acepta salt explícito
- `SetupMasterPassword()` genera salt aleatorio y lo persiste en `hash.dat`
- `Unlock()` carga el salt de `hash.dat` y lo pasa a `HashPasswordWithSalt`

**Estado**: Corregido en Fase 0.

---

### SEC-005 — Deadlock mutex en KeyManager C++ (CVSS 6.5 - MEDIUM)

**Descripción**: `Unlock()` adquiría `m_mutex` y luego llamaba a `VerifyMasterPassword()`, que también intentaba adquirir `m_mutex`. Resultado: deadlock garantizado al intentar desbloquear el vault.

**PoC**:
```cpp
bool KeyManager::Unlock(const std::wstring& password) {
  std::lock_guard<std::mutex> lock(m_mutex); // adquiere mutex
  if (!VerifyMasterPassword(password)) { // DEADLOCK: también adquiere mutex
    return false;
  }
  // ...
}
```

**Corrección implementada**:
```cpp
bool KeyManager::VerifyMasterPasswordLocked(const std::wstring& password) {
  // Versión sin lock — solo llamar cuando ya se tiene m_mutex
  return ConstantTimeEqual(computedHash, m_passwordHash);
}

bool KeyManager::Unlock(const std::wstring& password) {
  std::lock_guard<std::mutex> lock(m_mutex);
  return VerifyMasterPasswordLocked(password); // no adquiere mutex
}
```

**Estado**: Corregido en Fase 0.

---

### SEC-006 — Archivos temporales no eliminados en error (CVSS 5.3 - MEDIUM)

**Descripción**: Los handlers de multer no eliminaban los archivos temporales en caso de error. Un atacante podía enviar archivos maliciosos que quedaban en disco indefinidamente.

**Corrección**:
```typescript
try {
  // procesar archivo
} finally {
  // SEC: siempre limpiar, incluso en caso de error
  if (tmpInput) await fs.promises.unlink(tmpInput).catch(() => {});
  if (tmpOutput) await fs.promises.unlink(tmpOutput).catch(() => {});
}
```

**Estado**: Corregido en Fase 0.

---

### SEC-007 — Entropía insuficiente en tokens de sesión (CVSS 6.8)

**Descripción original**: _No había sistema de sesiones_. Los tokens se han diseñado desde cero con 256 bits de entropía.

**Implementación**:
```typescript
crypto.randomBytes(32).toString('hex') // 64 chars hex = 256 bits
```

Con 256 bits de entropía, adivinar un token por fuerza bruta requeriría 2^256 intentos — computacionalmente imposible.

---

### SEC-008 — Sin rate limiting en login (CVSS 7.5 - HIGH)

**Descripción**: Sin rate limiting, un atacante podía lanzar un ataque de diccionario sobre la contraseña maestra.

**Corrección**: `express-rate-limit` limita `/api/` a 100 requests por 15 minutos por IP. Para el endpoint de login específicamente, se recomienda reducir a 10 intentos por hora (mejora planificada).

---

### SEC-009 — Headers HTTP de seguridad ausentes (CVSS 4.3)

**Corrección**: `helmet()` añade automáticamente:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (si HTTPS)
- `Content-Security-Policy` básico

---

### SEC-010 — Sin autenticación en endpoint de verificación (CVSS 3.1 - LOW)

**Descripción**: `POST /api/verify` permite verificar si un archivo es un `.scrypt` válido sin autenticación. Esto es intencional por diseño (función de utilidad pública), pero se documenta como decisión consciente.

## 7.3 Análisis STRIDE

| Componente | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation |
|------------|---------|----------|-------------|----------------|-----|-----------|
| Auth endpoint | Mitigado | Mitigado | Parcial | Mitigado | Parcial | Mitigado |
| File encrypt | N/A | Mitigado (GCM tag) | N/A | Mitigado | Parcial | Mitigado |
| AI endpoints | Mitigado | Mitigado | N/A | Mitigado | Parcial | Mitigado |
| SessionStore | N/A | N/A | N/A | Bajo (in-memory) | Bajo | Mitigado |

## 7.4 Arquitectura multi-usuario y WebAuthn (Fase 2)

### 7.4.1 Autenticación multi-usuario con Argon2id por vault

En Fase 2 se extendió el sistema de autenticación para soportar múltiples usuarios independientes. Cada usuario tiene:

- **Vault propio**: directorio `data/users/{userId}/` aislado del resto de usuarios.
- **Hash de credencial separado**: `deriveKeyForStorage(password)` genera un hash Argon2id para verificar la contraseña en login, independiente del hash KDF usado para derivar la clave de cifrado.
- **Clave maestra por usuario**: `getMasterKey(userId, password)` carga el hash Argon2id del vault del usuario y re-deriva la clave AES-256 para la sesión.

Este diseño garantiza que un compromiso del vault de un usuario no afecta a otros usuarios.

### 7.4.2 WebAuthn / FIDO2 Passkeys

SecureCrypt implementa autenticación sin contraseña mediante passkeys (WebAuthn Level 2) usando `@simplewebauthn/server` v13:

```
Usuario              Navegador              Servidor SecureCrypt
  │                     │                          │
  │──── clic passkey ───▶│                          │
  │                     │──── GET /webauthn/ ──────▶│
  │                     │◀─── challenge ───────────│
  │◀─── biometría/PIN ──│                          │
  │                     │──── POST /webauthn/ ─────▶│
  │                     │     {response, id}        │
  │                     │◀─── sessionToken ─────────│
```

**Seguridad de passkeys frente a contraseñas**:

| Vector | Contraseña | Passkey |
|--------|-----------|---------|
| Phishing | VULNERABLE | Inmune (origin binding) |
| Brute force | Parcial (rate limit) | Imposible (clave pública) |
| Database leak | Hash expuesto | Solo clave pública |
| MITM | Parcial (HTTPS) | Inmune (challenge firmado) |

La clave privada nunca abandona el dispositivo del usuario. El servidor solo almacena la clave pública y el contador de autenticaciones (protección anti-replay).

### 7.4.3 Almacenamiento SQLite con persistencia de sesiones

Las sesiones se persisten en SQLite (tabla `sessions`) para sobrevivir reinicios del servidor, mientras que la clave maestra permanece solo en memoria:

```
SessionStore (memoria)          SQLite (disco)
  token → { masterKey, userId }   sessions(token, userId, expiresAt)
  
  getSession(token):
    1. Leer de mem → obtiene masterKey
    2. touchSession(token) en DB → verifica TTL y desliza expiración
    3. Si expirado: zeroize masterKey, eliminar de ambos
```

La separación garantiza que aunque el archivo SQLite sea robado, no contiene claves maestras (solo tokens opacos y expiración).

## 7.5 Cumplimiento OWASP ASVS 4.0

| Sección | Nivel | Controles verificados | Estado |
|---------|-------|----------------------|--------|
| V2 Autenticación | L2 | V2.1, V2.4, V2.6 | Cumple |
| V2.8 Passkeys | L2 | V2.8.1 (WebAuthn Level 2) | Cumple (Fase 2) |
| V3 Gestión de sesiones | L2 | V3.2, V3.3, V3.5 | Cumple |
| V3.5 Token revocación | L2 | DELETE session on logout | Cumple (Fase 2) |
| V6 Criptografía almacenada | L2 | V6.2, V6.3, V6.4 | Cumple |
| V7 Mensajes de error | L1 | V7.1, V7.2 | Cumple |
| V9 Comunicaciones | L1 | V9.1 (HTTPS recomendado) | Parcial |
| V12 Archivos y recursos | L2 | V12.3 (path traversal) | Cumple |
