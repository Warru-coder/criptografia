# Auditoría Técnica Completa — SecureCrypt v0.3.0

> **Fecha**: Junio 2026  
> **Auditor**: Análisis arquitectónico automatizado + revisión manual  
> **Alcance**: Repositorio completo (Node.js/TypeScript, C++20 Win32, Android Kotlin)

---

## 1. Resumen Ejecutivo

SecureCrypt es una suite de cifrado de archivos multiplataforma de nivel técnico superior a la media para un TFM académico. Implementa criptografía moderna (AES-256-GCM, Argon2id) con streaming para archivos de cualquier tamaño, tres plataformas (CLI/Web, Windows nativo, Android), CI/CD automatizado y un sistema de agentes IA con roles diferenciados. Sin embargo, presenta **inconsistencias criptográficas críticas entre plataformas**, una **vulnerabilidad de path traversal** en la API web y varios problemas de higiene de repositorio que deben corregirse antes de cualquier release.

**Puntuación global**: 6.8/10 (detalle por dimensión en sección 7)

---

## 2. Inventario del Proyecto

| Subproyecto | Lenguaje | Estado | Líneas de código (est.) |
|---|---|---|---|
| CLI + Web API | TypeScript/Node.js | Funcional | ~3.500 |
| App Windows | C++20 Win32 | Funcional | ~6.000 |
| App Android | Kotlin/Compose | Funcional | ~4.000 |
| Tests (Node.js) | TypeScript/Vitest | 34 tests | ~1.200 |
| Tests (C++) | C++ manual | 16 tests | ~400 |
| Tests (Android) | Kotlin/JUnit | 12 tests | ~300 |
| CI/CD | GitHub Actions | Configurado | ~80 líneas YAML |
| Agentes IA | OpenCode/Ollama | Configurado | 4 skills |

---

## 3. Fortalezas

### 3.1 Criptografía Correcta en la Capa Node.js
- **AES-256-GCM** con IV único por operación (16 bytes CSPRNG).
- **Argon2id** con parámetros OWASP: `memoryCost=65536 KB`, `timeCost=3`, `parallelism=2`.
- Formato de archivo `.scrypt` con header de 128 bytes bien definido: magic, versión, salt, IV, parámetros KDF, nombre original, tamaño original y auth tag GCM al final.
- Streaming de archivos: no carga el archivo completo en memoria, escala a ficheros de GB.

### 3.2 Arquitectura por Capas Clara (especialmente Android)
- Android implementa Clean Architecture + MVVM + Hilt DI correctamente.
- Windows C++ separa UI/App/Core/Data con buena cohesión de responsabilidades.
- Node.js mantiene separación entre capa crypto, filesystem, background tasks y presentación.

### 3.3 Testing Real y Útil
- Tests que verifican propiedades criptográficas reales: clave incorrecta falla con error, IV único por archivo, auth tag válido.
- Tests de estrés para memory leaks (20 cifrados concurrentes, heap delta < 50 MB).
- Tests de integración con ciclo completo cifrado/descifrado.

### 3.4 Worker Pool y Procesamiento Concurrente
- `WorkerPool` con `worker_threads` para paralelismo real en Node.js.
- `PauseResumeController` (EventEmitter) para operaciones pausables.
- `CheckpointManager` para reanudación tras interrupción.
- `TaskScheduler` para operaciones programadas.

### 3.5 Características de Seguridad del Sistema (Windows C++)
- ASLR, DEP, CFG habilitados en flags MSVC (`/DYNAMICBASE /NXCOMPAT /guard:cf`).
- `SecureMemory`: `VirtualAlloc` + `VirtualLock` + `SecureZeroMemory` en destructores.
- `AntiDebug`: detección activa de debuggers (`IsDebuggerPresent`, `CheckRemoteDebuggerPresent`).
- DPAPI para protección de claves maestras ligada al perfil del usuario.
- Stack canaries y `/GS` MSVC.

### 3.6 Sistema de Agentes IA con Roles Separados
- Agente `lead-developer`: puede editar/ejecutar, sigue flujo Plan→Implement→Test→Document.
- Agente `security-supervisor`: solo lectura, no puede modificar código, genera reportes con severidad.
- Skills especializadas: crypto, architecture, testing, security-audit.
- Modelo local (Qwen 2.5 Coder 7B vía Ollama): privacidad total, sin envío de código a terceros.

### 3.7 CI/CD con Empaquetado Automático
- Pipeline completo: lint → test → build → package → release.
- Genera `securecrypt.exe` con Node.js embebido vía `@yao-pkg/pkg`.
- Release automático en GitHub al crear un tag.

---

## 4. Debilidades

### 4.1 Críticas (Bloquean release)

#### CRIT-001: Path Traversal en API Web
**Archivo**: `src/web/routes/apiRoutes.ts`, líneas 199-293  
**Descripción**: Los endpoints `/api/encrypt-dir` y `/api/decrypt-dir` aceptan `inputPath` y `outputPath` del cuerpo de la petición HTTP sin validar que estén dentro de un directorio permitido (sandbox). Un atacante local o remoto podría cifrar o destruir archivos arbitrarios del sistema operativo.  
**CVSS**: 8.8 (High) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H  
**Mitigación**: Implementar `path.resolve()` + validación que el resultado comience con el directorio base autorizado.

```typescript
// VULNERABLE
const inputPath = req.body.inputPath; // Puede ser ../../../../etc/passwd

// CORRECTO
const BASE_DIR = process.env.ALLOWED_BASE_DIR ?? os.homedir();
const resolved = path.resolve(inputPath);
if (!resolved.startsWith(BASE_DIR)) throw new ForbiddenError('...');
```

#### CRIT-002: Contraseña Maestra en Cada Request HTTP
**Archivo**: `src/web/routes/apiRoutes.ts`  
**Descripción**: Cada petición a `/api/encrypt` y `/api/decrypt` incluye la contraseña maestra en el body JSON. No existe sistema de sesión, token JWT, ni derivación de clave en el lado del servidor con almacenamiento temporal seguro.  
**Riesgo**: La contraseña aparece en logs de petición, trazas de red, y cualquier middleware de auditoría.  
**Mitigación**: Implementar sesión temporal con `express-session` + almacenamiento en memoria segura. Derivar la clave en el inicio de sesión y mantener solo el material derivado (nunca la contraseña en claro).

#### CRIT-003: KDF Inconsistente Entre Plataformas — Documentación Engañosa
**Descripción**: Las tres plataformas declaran usar "Argon2id" en la documentación, pero implementan KDFs completamente distintos:

| Plataforma | KDF Real | Seguridad |
|---|---|---|
| Node.js | Argon2id (65536KB, 3 iter, 2 par) | ✅ Correcto (OWASP) |
| Windows C++ | Loop manual SHA-256 × 100 iteraciones | ❌ Muy débil (~1000× menos costoso que PBKDF2 real) |
| Android | PBKDF2-HMAC-SHA256 × 30.000 iter (3×10.000) | ⚠️ Aceptable pero no Argon2id |

La constante `PBKDF2_ITERATIONS=100000` en Windows C++ nunca produce 100.000 iteraciones reales porque el loop es `i < PBKDF2_ITERATIONS/1000` = 100 iteraciones.  
**Consecuencia**: Los archivos cifrados con Windows C++ son significativamente más vulnerables a ataques de fuerza bruta.

#### CRIT-004: `KeyManager::HashPassword` en Windows Genera Salt Nuevo Cada Llamada
**Archivo**: `criptografia-app-windows/src/core/crypto/KeyManager.cpp`  
**Descripción**: La función genera un salt aleatorio en cada invocación. La verificación de contraseña compara hashes calculados con salts distintos, lo que significa que `VerifyMasterPassword` **nunca puede devolver true** correctamente. La autenticación está lógicamente rota.

#### CRIT-005: Comparación No Constante en Tiempo (Timing Attack)
**Archivo**: `criptografia-app-windows/src/core/crypto/KeyManager.cpp`, `VerifyMasterPassword`  
**Descripción**: La comparación `inputHash == m_passwordHash` usa el operador `==` de `std::vector<BYTE>`, que termina en el primer byte diferente. Es vulnerable a timing attacks para adivinar bytes del hash.  
**Mitigación**: Usar `crypto_memcmp` equivalente o `BCryptSecretAgreement` con comparación de longitud fija.

---

### 4.2 Altas (Deben corregirse antes del TFM)

#### HIGH-001: Archivos Temporales No Limpiados en Rutas de Error
**Archivo**: `src/web/routes/apiRoutes.ts`  
Los archivos subidos vía `multer` a `tmp/` solo se eliminan en el path feliz. Si la operación de cifrado falla, el archivo original en claro queda en `tmp/` indefinidamente.

#### HIGH-002: Archivos de Prueba Reales en el Repositorio
El repositorio contiene:
- `prueba/test.docx`, `prueba/des.decrypted`, `prueba/*.scrypt`
- `pruebacripto1.txt.scrypt`, `pruebacripto2.txt`
- `tmp/` con 4 archivos binarios UUID

Estos son artefactos de pruebas manuales. Podrían contener información sensible y contaminan el historial de git.

#### HIGH-003: Metadatos Exponen Rutas Absolutas del Sistema
**Archivo**: `src/core/metadata.ts`  
Los archivos `.meta.json` almacenan `originalPath` y `encryptedPath` como rutas absolutas del sistema operativo del usuario. Si alguien accede a los metadatos, conoce la estructura de directorios y el nombre de usuario del sistema.

#### HIGH-004: Merge Conflict Sin Resolver en README.md
**Archivo**: `README.md`, líneas ~120-123  
Contiene marcadores `=======` y `>>>>>>>` de un merge conflict no resuelto.

---

### 4.3 Medias

#### MED-001: Duplicación Funcional — `cryptoUtils.ts` vs `engine.ts`
Existen dos motores criptográficos en Node.js. `engine.ts` es un subconjunto de `cryptoUtils.ts` con una firma ligeramente diferente. `vault.ts` usa `engine.ts` mientras el resto usa `cryptoUtils.ts`. Aumenta la superficie de mantenimiento.

#### MED-002: Versión Desactualizada en CLI
`src/cli/cliParser.ts` declara `.version('0.2.0')` cuando `package.json` es `0.3.0`.

#### MED-003: `require('os')` en Módulo ES
`src/core/constants.ts` usa `require('os')` en un módulo TypeScript configurado como `NodeNext` (ES modules). Mezcla de estilos que puede causar problemas en runtime.

#### MED-004: Sin Validación de Rutas en CLI
El subcomando `encrypt-dir` y `decrypt-dir` de la CLI no validan que el directorio de entrada exista ni que el de salida sea escribible antes de iniciar la operación.

#### MED-005: Falta `npm audit` en CI Pipeline
El `.github/workflows/ci.yml` no incluye auditoría de dependencias. Vulnerabilidades conocidas en dependencias no se detectarían automáticamente.

---

## 5. Análisis SWOT

### Fortalezas (Strengths)
1. Criptografía correcta y moderna en la capa principal
2. Tres plataformas funcionales con arquitectura limpia
3. Suite de tests real con casos de seguridad
4. Sistema de agentes IA operativo con privacidad (local)
5. CI/CD con empaquetado automatizado
6. Características de seguridad del sistema (ASLR, DEP, DPAPI, SecureZeroMemory)
7. Streaming: escala a archivos de cualquier tamaño

### Debilidades (Weaknesses)
1. KDF inconsistente entre plataformas (riesgo de seguridad real)
2. Vulnerabilidad path traversal en API web
3. Sin modelo de sesión en interfaz web
4. Gestión de contraseña maestra en Windows lógicamente rota
5. Higiene de repositorio deficiente (archivos sensibles commiteados)
6. Sin interoperabilidad de archivos entre plataformas
7. Documentación engañosa (declara Argon2id donde no se usa)

### Oportunidades (Opportunities)
1. Mercado GDPR/compliance para PYMEs, despachos y consultorias
2. Integración de IA como diferenciador (auditor de config, asistente)
3. Motor RAG para documentación técnica de criptografía
4. API como servicio (CaaS - Cryptography as a Service)
5. Plugin para herramientas existentes (VSCode, integración cloud)
6. Certificación FIPS 140-2/3 para mercados regulados
7. Open Source con tier enterprise

### Amenazas (Threats)
1. **Competidores maduros**: VeraCrypt (código abierto, auditado), Cryptomator (cloud-friendly), 7-Zip (AES-256)
2. **Confianza del usuario**: la criptografía requiere auditorías externas para ser adoptada en entornos profesionales
3. **Regulatorio**: GDPR art. 32, eIDAS, esquemas nacionales de certificación
4. **Complejidad de gestión de claves**: si el usuario pierde su contraseña, pierde los datos permanentemente
5. **Ataques a la supply chain**: Node.js tiene muchas dependencias transitivas
6. **Quantum computing** (horizonte 5-10 años): AES-256 es resistente, pero los KDF actuales tendrán que revisarse

---

## 6. Análisis por Dimensión

| Dimensión | Puntuación | Justificación |
|---|---|---|
| Criptografía (Node.js) | 8.5/10 | AES-256-GCM + Argon2id correcto |
| Criptografía (C++ / Android) | 4.5/10 | KDF roto/débil, comparación timing |
| Arquitectura | 7.0/10 | Buena separación en capas, algo de duplicación |
| Testing | 7.5/10 | Buen coverage de propiedades criptográficas |
| Seguridad aplicación | 5.0/10 | Path traversal, password en request |
| Documentación | 4.0/10 | README con conflicts, declaraciones engañosas |
| CI/CD | 7.0/10 | Funcional, falta npm audit y SAST |
| Integración IA | 6.0/10 | Sistema de agentes creativo pero no en producto |
| Escalabilidad | 7.0/10 | Worker pool, streaming, arquitectura modular |
| UX/Usabilidad | 5.5/10 | CLI funcional, web básica, sin onboarding |
| **TOTAL** | **6.8/10** | |
