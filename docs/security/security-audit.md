# Auditoría de Seguridad — SecureCrypt

> Metodología: OWASP Top 10 2021, OWASP ASVS 4.0, OWASP Cryptographic Storage Cheat Sheet, NIST SP 800-175B

---

## 1. Resumen de Hallazgos

| ID | Categoría OWASP | Severidad | Estado |
|---|---|---|---|
| SEC-001 | A01 Broken Access Control (Path Traversal) | CRITICAL | Abierto |
| SEC-002 | A02 Cryptographic Failures (KDF débil C++) | HIGH | Abierto |
| SEC-003 | A02 Cryptographic Failures (comparación timing) | HIGH | Abierto |
| SEC-004 | A07 Identification & Auth (password en request) | HIGH | Abierto |
| SEC-005 | A02 Cryptographic Failures (KDF roto C++ — salt nuevo) | CRITICAL | Abierto |
| SEC-006 | A05 Security Misconfiguration (archivos sensibles en repo) | MEDIUM | Abierto |
| SEC-007 | A09 Security Logging (metadata expone rutas absolutas) | MEDIUM | Abierto |
| SEC-008 | A06 Vulnerable Components (sin npm audit en CI) | MEDIUM | Abierto |
| SEC-009 | A02 (Android — HMAC personalizado no estándar) | MEDIUM | Abierto |
| SEC-010 | A04 Insecure Design (archivos tmp no limpiados en error) | HIGH | Abierto |

---

## 2. Hallazgos Detallados

### SEC-001 — Path Traversal en API REST (CRITICAL)
**OWASP**: A01:2021 — Broken Access Control  
**CVSS 3.1**: 8.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)

**Descripción**: Los endpoints `POST /api/encrypt-dir` y `POST /api/decrypt-dir` aceptan `inputPath` y `outputPath` del body sin sandbox. Permite acceso a cualquier ruta del sistema de archivos.

**Prueba de concepto**:
```bash
curl -X POST http://localhost:3000/api/encrypt-dir \
  -H "Content-Type: application/json" \
  -d '{"inputPath": "C:/Windows/System32", "outputPath": "C:/tmp/stolen", "password": "x"}'
```

**Remediación**:
```typescript
import { resolve, normalize } from 'path';

const ALLOWED_BASE = process.env.SECURECRYPT_BASE_DIR ?? homedir();

function sandboxPath(userInput: string): string {
  const resolved = normalize(resolve(ALLOWED_BASE, userInput));
  if (!resolved.startsWith(ALLOWED_BASE + sep)) {
    throw new ForbiddenPathError(`Path escapes sandbox: ${userInput}`);
  }
  return resolved;
}
```

---

### SEC-002 — KDF Débil en Windows C++ (HIGH)
**OWASP**: A02:2021 — Cryptographic Failures  
**CWE**: CWE-916 (Use of Password Hash With Insufficient Computational Effort)

**Descripción**: `CryptoEngine::DeriveKey` realiza un loop manual `i < PBKDF2_ITERATIONS/1000` = **100 iteraciones** de SHA-256. PBKDF2-SHA256 con 100 iteraciones es aproximadamente **1000 veces** más rápido de romper que con 100.000 iteraciones. Según OWASP, el mínimo es 600.000 iteraciones para PBKDF2-SHA256 en 2024.

**Comparativa de tiempo de cracking (contraseña de 8 caracteres)**:
| KDF | Iteraciones | Tiempo estimado (GPU moderna) |
|---|---|---|
| SHA-256 × 100 (actual) | 100 | ~segundos |
| PBKDF2-SHA256 × 600.000 | 600.000 | ~horas |
| Argon2id (64MB, 3 iter) | — | ~días-semanas |

**Remediación**: Reemplazar por `libsodium::crypto_pwhash` (Argon2id) o como mínimo PBKDF2 con 600.000 iteraciones usando `BCryptDeriveKeyPBKDF2`.

---

### SEC-003 — Comparación No Constante en Tiempo (HIGH)
**OWASP**: A02:2021 — Cryptographic Failures  
**CWE**: CWE-208 (Observable Timing Discrepancy)

**Descripción**: En `KeyManager::VerifyMasterPassword`, la comparación `inputHash == m_passwordHash` usa `std::vector<T>::operator==` que realiza un early-exit en el primer byte diferente. Un atacante con medición de tiempo precisa puede inferir bytes del hash.

**Remediación**:
```cpp
bool ConstantTimeCompare(const std::vector<BYTE>& a, const std::vector<BYTE>& b) {
    if (a.size() != b.size()) return false;
    volatile BYTE result = 0;
    for (size_t i = 0; i < a.size(); ++i) {
        result |= a[i] ^ b[i];
    }
    return result == 0;
}
```
O usar `CryptVerifySignatureHash` / funciones CNG equivalentes.

---

### SEC-004 — Contraseña Maestra en Cada Request HTTP (HIGH)
**OWASP**: A07:2021 — Identification and Authentication Failures  
**CWE**: CWE-312 (Cleartext Storage of Sensitive Information)

**Descripción**: La contraseña maestra se transmite en el body de cada petición HTTP. Riesgos:
- Aparece en logs de acceso de Express/nginx/proxies
- Aparece en traces de herramientas de observabilidad (Datadog, New Relic)
- Cualquier middleware puede leerla
- Si HTTPS no está configurado, viaja en claro

**Remediación**: Sistema de sesión con autenticación inicial.
```
POST /api/auth/login  { password }  → { sessionToken, expiresAt }
POST /api/encrypt     { sessionToken, filePath }  → (usa clave derivada en sesión)
POST /api/auth/logout { sessionToken }
```

---

### SEC-005 — `HashPassword` Genera Salt Nuevo Cada Llamada (CRITICAL)
**OWASP**: A02:2021 — Cryptographic Failures  
**CWE**: CWE-760 (Use of a One-Way Hash with a Predictable Salt)

**Descripción**: `KeyManager::HashPassword` en la implementación C++ genera un salt aleatorio interno en cada llamada. La función `VerifyMasterPassword` llama `HashPassword(inputPassword)` y compara con `m_passwordHash` que fue calculado con un salt diferente. La autenticación **nunca puede verificar correctamente** una contraseña correcta — siempre producirá falso negativo (o se almacena la comparación de forma incorrecta en el código).

**Remediación**: El salt debe almacenarse junto al hash y reutilizarse en la verificación.
```cpp
// Almacenamiento
m_passwordSalt = GenerateRandomBytes(32);
m_passwordHash = HashPasswordWithSalt(password, m_passwordSalt);

// Verificación
bool verify = ConstantTimeCompare(
    HashPasswordWithSalt(input, m_passwordSalt),
    m_passwordHash
);
```

---

### SEC-006 — Archivos Sensibles en Repositorio (MEDIUM)
**OWASP**: A05:2021 — Security Misconfiguration  

**Archivos problemáticos**:
- `prueba/test.docx` — documento real del usuario
- `prueba/des.decrypted` — archivo descifrado real
- `tmp/*.bin` — artefactos de multer con contenido binario
- `prueba/*.scrypt` — archivos cifrados (incluyen salt e IV, aunque no descifran sin clave)

**Remediación**:
1. Añadir al `.gitignore`: `prueba/`, `tmp/`, `*.scrypt`, `*.decrypted`
2. Eliminar del historial con `git filter-branch` o `git-filter-repo`
3. Generar fixtures de test con datos ficticios sintéticos

---

### SEC-007 — Metadatos Exponen Rutas Absolutas (MEDIUM)
**OWASP**: A09:2021 — Security Logging and Monitoring Failures  

**Descripción**: Los archivos `.meta.json` almacenan `originalPath: "C:/Users/Gabriel/Desktop/..."`. Un adversario con acceso a los archivos cifrados puede reconstruir la estructura de directorios y el nombre de usuario del sistema original.

**Remediación**: Almacenar solo el nombre de archivo (`originalName`) sin la ruta completa. Si se necesita la ruta para restore automatizado, cifrarla junto con el contenido.

---

### SEC-008 — Sin Auditoría de Dependencias en CI (MEDIUM)
**OWASP**: A06:2021 — Vulnerable and Outdated Components  

**Remediación**: Añadir a `.github/workflows/ci.yml`:
```yaml
- name: Audit dependencies
  run: npm audit --audit-level=high
  
- name: License check
  run: npx license-checker --failOn GPL
```
Y activar **GitHub Dependabot** en el repositorio.

---

### SEC-009 — HMAC Personalizado en Android (MEDIUM)
**OWASP**: A02:2021 — Cryptographic Failures  
**CWE**: CWE-327 (Use of Broken or Risky Cryptographic Algorithm)

**Descripción**: `EncryptionService.kt` implementa HMAC-SHA256 manualmente usando `MessageDigest` en lugar de `javax.crypto.Mac.getInstance("HmacSHA256")`. Las implementaciones manuales de HMAC son propensas a errores sutiles (padding incorrecto, fallo en el preprocesado de clave).

**Remediación**:
```kotlin
// VULNERABLE — implementación manual
fun hmac(key: ByteArray, data: ByteArray): ByteArray {
    val padKey = if (key.size > 64) MessageDigest.getInstance("SHA-256").digest(key) else key
    // ... manual XOR con ipad/opad
}

// CORRECTO — API estándar Java
fun hmac(key: ByteArray, data: ByteArray): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(key, "HmacSHA256"))
    return mac.doFinal(data)
}
```

---

### SEC-010 — Archivos Temporales No Limpiados en Errores (HIGH)
**OWASP**: A04:2021 — Insecure Design  

**Descripción**: En `apiRoutes.ts`, el archivo subido vía multer a `tmp/` solo se elimina en el path feliz. Un error de red, timeout o excepción en la pipeline de cifrado deja el archivo original **en claro** en el directorio temporal indefinidamente.

**Remediación**:
```typescript
app.post('/api/encrypt', upload.single('file'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    // ... operación
    res.json({ success: true });
  } finally {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => {}); // siempre limpiar
  }
});
```

---

## 3. Gestión de Secretos y Claves

### Estado Actual
| Elemento | Estado |
|---|---|
| Claves en código fuente | ✅ No se encontraron |
| Variables de entorno | ✅ Se usa `.env` pattern |
| Secrets en CI | ✅ GitHub Secrets (implícito en workflow) |
| Claves en logs | ⚠️ No verificado completamente |
| Claves en core dumps | ⚠️ SecureMemory en C++ lo mitiga, no en Node.js |

### Recomendaciones
1. Implementar `SecureBuffer` equivalente en Node.js: `Buffer.alloc()` + limpiar con `buffer.fill(0)` en finally
2. Añadir `--expose-gc` en desarrollo para forzar GC de materiales criptográficos
3. Considerar integración con HashiCorp Vault o AWS Secrets Manager para tier enterprise

---

## 4. Hardening del Servidor Web (Express)

### Estado Actual
| Control | Estado |
|---|---|
| `helmet` (cabeceras HTTP) | ✅ Configurado |
| `express-rate-limit` | ✅ Configurado |
| CORS configurado | ❓ No verificado |
| HTTPS obligatorio | ❓ No configurado en dev |
| Request size limit | ❓ No explícito |
| Content-Type validation | ⚠️ Solo multer, no en JSON endpoints |

### Configuración Recomendada
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

app.use(express.json({ limit: '1mb' })); // Limitar JSON body
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
```

---

## 5. Cumplimiento Normativo

### GDPR (Reglamento 2016/679)
| Artículo | Requisito | Estado SecureCrypt |
|---|---|---|
| Art. 5 | Minimización de datos | ⚠️ Metadatos exponen demasiado |
| Art. 25 | Privacy by Design | ✅ Cifrado es la función principal |
| Art. 32 | Medidas técnicas adecuadas | ⚠️ KDF inconsistente entre plataformas |
| Art. 83 | Sanciones por incumplimiento | Riesgo alto si se comercializa |

### ENS (Esquema Nacional de Seguridad — España)
- Categoría aplicable: **Media** (datos personales, información confidencial de empresa)
- Controles relevantes: MP.SI.2 (cifrado de información), OP.EX.1 (inventario de activos)

### NIST SP 800-131A
- AES-256: ✅ Aprobado hasta 2030+
- SHA-256: ✅ Aprobado
- PBKDF2: ✅ Aprobado (con iteraciones adecuadas)
- Argon2id: ✅ Recomendado por NIST SP 800-63B

---

## 6. Plan de Remediación Priorizado

| Prioridad | ID | Acción | Esfuerzo | Impacto |
|---|---|---|---|---|
| P0 | SEC-001 | Implementar sandbox de rutas | 4h | Elimina path traversal |
| P0 | SEC-005 | Corregir HashPassword en C++ | 3h | Autenticación funcional |
| P1 | SEC-004 | Sistema de sesión Express | 8h | Elimina password en request |
| P1 | SEC-010 | Try/finally en rutas multer | 2h | Limpieza garantizada |
| P1 | SEC-002 | Reemplazar KDF C++ por libsodium | 12h | KDF seguro multiplataforma |
| P2 | SEC-003 | Comparación tiempo constante C++ | 1h | Mitiga timing attack |
| P2 | SEC-006 | Limpiar repo + gitignore | 2h | Higiene repositorio |
| P2 | SEC-007 | Eliminar rutas absolutas de metadata | 3h | Privacy by design |
| P3 | SEC-008 | npm audit en CI | 0.5h | Detección automática |
| P3 | SEC-009 | Reemplazar HMAC manual Android | 2h | Implementación estándar |
