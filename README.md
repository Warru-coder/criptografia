# SecureCrypt

**Suite de cifrado de archivos multiplataforma con inteligencia artificial integrada**

[![CI](https://github.com/Warru-coder/criptografia/actions/workflows/ci.yml/badge.svg)](https://github.com/Warru-coder/criptografia/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](https://github.com/Warru-coder/criptografia/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Security](https://img.shields.io/badge/crypto-AES--256--GCM%20%2B%20Argon2id-success)](docs/security/security-audit.md)

---

## Descripción

SecureCrypt es una suite de cifrado de archivos de nivel profesional que combina criptografía moderna (AES-256-GCM + Argon2id) con inteligencia artificial para proporcionar no solo cifrado seguro, sino también **auditoría automática de configuraciones** y un **asistente experto en criptografía** basado en RAG.

El proyecto está disponible en tres plataformas:
- **CLI + API REST** (Node.js/TypeScript) — para scripting, automatización e integración
- **Aplicación de escritorio** (C++20/Win32) — para Windows, con características de seguridad avanzadas del sistema operativo
- **Aplicación móvil** (Android/Kotlin + Jetpack Compose) — con autenticación biométrica y Android Keystore

---

## El Problema que Resuelve

Las organizaciones gestionan miles de documentos confidenciales (contratos, nóminas, datos de clientes) sin protección adecuada. Las herramientas existentes presentan barreras:

- **VeraCrypt/GPG**: curva de aprendizaje alta, UI técnica para usuarios no expertos
- **Soluciones cloud**: requieren enviar los datos a servidores de terceros
- **Herramientas básicas** (7-Zip): usan KDF inadecuados, sin validación de configuración, sin alertas de seguridad

SecureCrypt resuelve esto con una interfaz accesible, cifrado correctamente implementado y un auditor de IA que alerta si la configuración no cumple con las recomendaciones OWASP/NIST.

---

## Características

### Criptografía
- Cifrado **AES-256-GCM** con autenticación (AEAD — Authenticated Encryption with Associated Data)
- Derivación de clave **Argon2id** con parámetros OWASP (64 MB, 3 iteraciones, 2 hilos en paralelo)
- IV único de 16 bytes generado criptográficamente por operación
- **Streaming**: cifra archivos de cualquier tamaño sin cargarlos en memoria
- Formato de archivo `.scrypt` con header estructurado de 128 bytes y verificación de integridad

### Gestión de Archivos
- Cifrado y descifrado de archivos individuales y directorios completos
- Procesamiento paralelo con pool de workers (Node.js `worker_threads`)
- Soporte para pausar y reanudar operaciones largas
- Checkpoints para recuperación ante interrupciones

### Inteligencia Artificial
- **Auditor de configuración**: analiza los parámetros de cifrado y detecta debilidades con referencias a OWASP/NIST
- **Asistente RAG**: responde preguntas sobre criptografía usando documentación técnica vectorizada (OWASP, NIST SP 800-131A, RFC 9106)
- **Clasificador de sensibilidad**: sugiere el nivel de protección adecuado para cada archivo
- Funciona con **IA completamente local (Ollama)** por defecto — ningún dato sale del dispositivo

### Seguridad del Sistema
- Comparaciones de hashes en tiempo constante (anti timing-attack)
- Windows: ASLR, DEP, CFG (Control Flow Guard), DPAPI, `SecureZeroMemory`, AntiDebug
- Android: Android Keystore Hardware-backed, autenticación biométrica BIOMETRIC_STRONG, SQLCipher

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│      CLI (Commander)  │  REST API (Express)  │  Win32 UI        │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│   EncryptFileUseCase │ DecryptFileUseCase │ AuditConfigUseCase  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                               │
│    Crypto Domain │ Vault Domain │ AI Domain │ Identity Domain   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                           │
│  NodeCryptoAdapter │ SQLiteAdapter │ OllamaAdapter │ FSAdapter  │
└─────────────────────────────────────────────────────────────────┘
```

Ver [Arquitectura Completa](docs/architecture/clean-architecture.md) para diagramas detallados y decisiones de diseño.

---

## Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime principal | Node.js + TypeScript | ≥20, 5.7 |
| Criptografía (Node) | AES-256-GCM (built-in) + argon2 | 0.40.3 |
| Criptografía (Windows) | Windows CNG (BCrypt) + DPAPI | Sistema |
| Criptografía (Android) | Android Keystore + SQLCipher | API 26+ |
| API REST | Express + Zod + Helmet | 4.21, 3.24, 8.0 |
| Rate limiting | express-rate-limit | 7.5 |
| Base de datos | SQLite | 3.x |
| IA local | Ollama + Qwen2.5-Coder:7B | — |
| Logging | Winston | 3.17 |
| Tests | Vitest + JUnit4 + Mockk | 2.1.8 |
| CI/CD | GitHub Actions | — |
| Empaquetado | @yao-pkg/pkg (genera .exe) | — |
| Android UI | Jetpack Compose | BOM 2024.02 |
| Android DI | Hilt | 2.50 |
| Windows Build | C++20 + MSVC + CMake | 3.20+ |

---

## Requisitos

### CLI + API (Node.js)
- Node.js 20 o superior
- npm 10 o superior
- Para IA local: [Ollama](https://ollama.ai) con modelo `qwen2.5-coder:7b-instruct-q4_K_M` (requiere 8 GB RAM)

### Aplicación Windows
- Windows 10 64-bit o superior (Windows 11 recomendado)
- Visual Studio 2022 con workload "Desktop development with C++"
- CMake 3.20 o superior

### Aplicación Android
- Android Studio Hedgehog (2023.1.1) o superior
- Android SDK API 26 (Android 8.0) mínimo, API 34 para compilar

---

## Instalación

### Desde el código fuente (Node.js/CLI)

```bash
# Clonar el repositorio
git clone https://github.com/Warru-coder/criptografia.git
cd criptografia

# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Verificar instalación
node dist/cli/cliParser.js --version
```

### Descargar ejecutable compilado (Windows, sin Node.js)
Descarga el último `securecrypt.exe` desde [Releases](https://github.com/Warru-coder/criptografia/releases).

### Compilar aplicación Windows (C++)
```powershell
cd criptografia-app-windows
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
# Ejecutable en: build/Release/SecureCrypt.exe
```

### Instalar IA local (Ollama)
```bash
# Instalar Ollama desde https://ollama.ai
# Descargar el modelo (una sola vez, ~4 GB)
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
```

---

## Configuración

### Variables de entorno (API web)

Crear un archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor (por defecto: 3000)
PORT=3000

# Directorio base permitido para operaciones de archivos (sandbox de seguridad)
SECURECRYPT_BASE_DIR=C:/Users/TuUsuario/Documents

# Proveedor de IA: 'ollama' (local, por defecto) o 'claude' (cloud opt-in)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5-coder:7b-instruct-q4_K_M

# Si AI_PROVIDER=claude (requiere consentimiento explícito del usuario)
# ANTHROPIC_API_KEY=sk-ant-...

# Duración de sesión en minutos (por defecto: 30)
SESSION_TIMEOUT_MINUTES=30

NODE_ENV=production
```

---

## Uso

### CLI

```bash
# Cifrar un archivo (contraseña solicitada de forma interactiva)
node dist/cli/cliParser.js encrypt documento.pdf

# Cifrar con salida específica
node dist/cli/cliParser.js encrypt documento.pdf --output ./cifrados/

# Descifrar un archivo
node dist/cli/cliParser.js decrypt documento.pdf.scrypt

# Cifrar un directorio completo (con 4 workers paralelos)
node dist/cli/cliParser.js encrypt-dir ./contratos --output ./contratos_cifrados --workers 4

# Generar contraseña segura
node dist/cli/cliParser.js generate-password --length 24 --symbols
```

### Servidor API

```bash
# Iniciar servidor
npm start
# o en modo desarrollo
npm run dev

# El servidor estará disponible en http://localhost:3000
```

### API REST — Endpoints principales

```bash
# 1. Autenticarse
POST /api/auth/login
Body: { "password": "tu-contraseña-maestra" }
Respuesta: { "sessionToken": "...", "expiresAt": "..." }

# 2. Cifrar archivo
POST /api/encrypt
Header: Authorization: Bearer <sessionToken>
Body: multipart/form-data con campo 'file'
Respuesta: { "fileName": "archivo.scrypt", "downloadUrl": "/api/download/..." }

# 3. Descifrar archivo
POST /api/decrypt
Header: Authorization: Bearer <sessionToken>
Body: multipart/form-data con campo 'file' (.scrypt)
Respuesta: archivo original descifrado

# 4. Auditoría de configuración con IA
POST /api/ai/audit
Header: Authorization: Bearer <sessionToken>
Body: { "config": { "algorithm": "AES-256-GCM", "kdf": "argon2id", ... } }
Respuesta: { "riskLevel": "low|medium|high", "findings": [...], "recommendations": [...] }

# 5. Chat con asistente criptográfico (RAG)
POST /api/ai/chat
Header: Authorization: Bearer <sessionToken>
Body: { "message": "¿Qué es un IV y por qué debe ser único?" }
Respuesta: { "answer": "...", "sources": [...] }
```

---

## Ejemplos

### Ejemplo 1: Proteger documentos antes de un envío
```bash
node dist/cli/cliParser.js encrypt-dir ~/Documentos/Contratos2025 \
  --output ~/Desktop/Contratos2025_cifrados \
  --workers 4
# Resultado: cada archivo → archivo.scrypt
# Tiempo estimado para 100 archivos de 1MB: ~30 segundos
```

### Ejemplo 2: Script de backup seguro nocturno
```bash
#!/bin/bash
FECHA=$(date +%Y%m%d)
BACKUP_PASSWORD="$(cat /etc/backup-key)" node dist/cli/cliParser.js \
  encrypt-dir /data/produccion \
  --output /backup/prod_${FECHA} \
  --workers 8
echo "Backup cifrado: $(du -sh /backup/prod_${FECHA})"
```

### Ejemplo 3: Verificar configuración con IA antes de usar
```bash
# La IA comprueba si tus parámetros cumplen OWASP 2024
node dist/cli/cliParser.js audit
# Salida: "✅ Configuración segura. Argon2id con 64MB supera el mínimo OWASP de 19MB."
# o: "⚠️ ADVERTENCIA: timeCost=1 es muy bajo. OWASP recomienda ≥3 para datos sensibles."
```

---

## Estructura del Proyecto

```
securecrypt/
├── src/                             # Código fuente TypeScript (CLI + API)
│   ├── crypto/                      # Módulo criptográfico
│   │   ├── cryptoUtils.ts           # Primitivas AES-GCM + Argon2id
│   │   ├── fileCipher.ts            # Cifrado streaming
│   │   ├── fileDecipher.ts          # Descifrado streaming con verificación
│   │   └── keyDerivation.ts         # Argon2id parametrizable
│   ├── core/                        # Núcleo de la aplicación
│   │   ├── constants.ts             # Configuración global
│   │   ├── errorHandler.ts          # Jerarquía de errores custom
│   │   └── vault.ts                 # Gestión de la contraseña maestra
│   ├── backgroundTasks/             # Procesamiento concurrente
│   │   ├── taskQueue.ts             # Cola de tareas con prioridades
│   │   ├── workerPool.ts            # Pool de worker_threads
│   │   ├── pauseResumeController.ts # Control de pausa/reanudación
│   │   ├── checkpointManager.ts     # Persistencia de estado
│   │   └── taskScheduler.ts         # Tareas programadas
│   ├── web/                         # API REST
│   │   ├── server.ts                # Configuración Express
│   │   └── routes/apiRoutes.ts      # Endpoints REST
│   ├── cli/                         # Interfaz de línea de comandos
│   │   └── cliParser.ts             # Definición de comandos
│   └── passwordManager/             # Gestor de contraseñas integrado
│       └── passwordValidator.ts     # Validación y scoring
├── tests/                           # Suite de tests
│   ├── unit/                        # Tests unitarios (Vitest)
│   ├── integration/                 # Tests de integración
│   └── stress/                      # Tests de memoria y concurrencia
├── criptografia-app-windows/        # Aplicación nativa Windows (C++20)
│   ├── src/
│   │   ├── core/crypto/             # CryptoEngine, KeyManager, FileCipher
│   │   ├── core/security/           # SecureMemory, AntiDebug
│   │   ├── ui/                      # Win32 UI, dialogs
│   │   └── storage/                 # SQLite + SQLCipher
│   └── tests/unit/test_crypto.cpp   # 16 tests unitarios C++
├── criptografia-app-android/        # Aplicación Android (Kotlin)
│   └── app/src/main/java/com/securecrypt/android/
│       ├── core/security/           # EncryptionService, KeystoreManager
│       ├── presentation/            # Compose UI + ViewModels
│       ├── di/                      # Hilt AppModule
│       └── database/                # Room + SQLCipher
├── docs/                            # Documentación completa
│   ├── analysis/audit.md            # Auditoría técnica completa
│   ├── architecture/                # Decisiones de diseño
│   ├── security/security-audit.md   # Reporte de seguridad OWASP
│   ├── ai/ai-integration.md         # Plan de integración de IA
│   ├── roadmap/roadmap.md           # Hoja de ruta del producto
│   ├── testing/testing-strategy.md  # Estrategia de testing
│   ├── business/                    # Estrategia comercial
│   └── tfm/tfm-structure.md         # Estructura memoria TFM
├── .opencode/                       # Sistema de agentes IA
│   ├── agent/lead-developer.md      # Agente desarrollador principal
│   ├── agent/security-supervisor.md # Agente auditor de seguridad (solo lectura)
│   └── skills/                      # Skills especializadas
├── .github/workflows/ci.yml         # Pipeline CI/CD
├── opencode.json                    # Configuración Ollama local
├── package.json                     # v0.3.0
├── tsconfig.json
└── vitest.config.ts
```

---

## Seguridad

### Algoritmos y Parámetros

| Componente | Algoritmo | Parámetros | Referencia |
|---|---|---|---|
| Cifrado | AES-256-GCM | Key 256-bit, Tag 128-bit, IV 128-bit | NIST SP 800-38D |
| KDF | Argon2id | mem=64MB, t=3, p=2, hash=32B | OWASP 2024 / RFC 9106 |
| IV | CSPRNG | 16 bytes únicos por operación | RFC 5116 |
| Salt | CSPRNG | 16 bytes únicos por archivo | NIST SP 800-132 |
| Hash integridad | SHA-256 | — | FIPS 180-4 |

### Formato del Archivo .scrypt

```
Offset  Tamaño  Campo
──────────────────────────────────────────────────────────
0       6       Magic: "SCRYPT" (0x53 0x43 0x52 0x59 0x50 0x54)
6       1       Versión del formato (0x01)
7       16      Salt Argon2id (CSPRNG, único por archivo)
23      16      IV AES-GCM (CSPRNG, único por archivo)
39      4       memoryCost Argon2id (uint32 little-endian)
43      1       timeCost Argon2id
44      1       parallelism Argon2id
45      8       Reservado (ceros)
53      2       Longitud nombre original (uint16 LE)
55      N       Nombre original del archivo (UTF-8)
55+N    M       Datos cifrados (AES-256-GCM, streaming)
Fin-16  16      Auth Tag GCM (integridad + autenticidad)
──────────────────────────────────────────────────────────
```

### Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, **no** la publiques como issue público. Envía un correo a [gabideltoya@gmail.com] con descripción detallada y pasos para reproducir. Responderé en 48 horas.

Ver [Auditoría de Seguridad Completa](docs/security/security-audit.md) para el detalle de los issues conocidos y su estado.

---

## Inteligencia Artificial

### En el entorno de desarrollo (ya implementado)
Un sistema de agentes IA con roles diferenciados:
- **`lead-developer`**: puede editar código, ejecutar tests, sigue flujo Plan→Implement→Test→Document
- **`security-supervisor`**: solo lectura, audita cada cambio criptográfico, puede bloquear releases

Basado en Ollama local con Qwen 2.5 Coder 7B — el código del proyecto nunca sale del dispositivo.

### En el producto (Roadmap v0.5.0)
- **Auditor de configuración**: detecta parámetros inseguros con referencias a estándares
- **Asistente RAG**: responde preguntas sobre criptografía con fuentes verificadas (NIST, OWASP, RFC)
- **Clasificador de sensibilidad**: recomienda nivel de protección por tipo de archivo

Ver [Plan de Integración de IA](docs/ai/ai-integration.md).

---

## Testing

```bash
# Ejecutar todos los tests
npm test

# Solo tests unitarios
npm run test:unit

# Solo tests de integración
npm run test:integration

# Con reporte de cobertura
npm run test:coverage
```

### Estado de la cobertura

| Módulo | Tests | Cobertura estimada |
|---|---|---|
| `crypto/` | 13 tests | ~75% |
| `backgroundTasks/` | 8 tests | ~60% |
| `passwordManager/` | 9 tests | ~85% |
| `web/routes/` | 4 tests | ~20% |
| **Total** | **34 tests** | **~45%** |

**Objetivo para TFM**: ≥80% cobertura.

Ver [Estrategia de Testing Completa](docs/testing/testing-strategy.md).

---

## Roadmap

| Versión | Estado | Descripción |
|---|---|---|
| v0.3.0 | ✅ Actual | CLI + API + Windows + Android funcionales |
| v0.4.0 | 🔄 Julio 2026 | Corrección issues de seguridad críticos |
| v0.5.0 | 🔄 Agosto 2026 | IA integrada en producto (auditor + RAG) |
| v1.0.0 | 🔄 2027 | Versión comercial con API pública |

Ver [Roadmap Completo](docs/roadmap/roadmap.md).

---

## Casos de Uso

| Sector | Necesidad | Solución SecureCrypt |
|---|---|---|
| Despachos de abogados | GDPR art. 32, documentos de clientes | Cifrado masivo + auditor de cumplimiento IA |
| Consultoría y auditoría | Informes confidenciales | CLI para scripting + API para integración |
| Sector salud | Datos de pacientes (HIPAA/RGPD) | Nivel de protección más alto por defecto |
| Desarrolladores | Integrar cifrado en sus apps | API REST documentada + SDK TypeScript |
| Usuarios individuales | Documentos personales sensibles | Aplicación de escritorio Windows |

---

## Contribución

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del repositorio
2. Crea una rama: `git checkout -b feature/nombre-feature`
3. Escribe código con tests
4. Verifica que pasan todos los tests: `npm test`
5. Sigue Conventional Commits: `feat:`, `fix:`, `docs:`, `security:`
6. Abre un Pull Request con descripción detallada

### Normas de seguridad para contribuidores
- **NUNCA** reducir los parámetros criptográficos por debajo de los valores por defecto
- Todos los cambios al módulo `src/crypto/` requieren review explícita de seguridad
- Los tests de seguridad (path traversal, timing) deben seguir pasando

---

## Licencia

MIT License — ver [LICENSE](LICENSE) para detalles.

---

## Autor

**Gabriel** — Trabajo Fin de Máster, Máster en Desarrollo de Software con IA  
GitHub: [@Warru-coder](https://github.com/Warru-coder)  
Email: gabideltoya@gmail.com

---

## Estado del Proyecto

| Dimensión | Estado |
|---|---|
| Funcionalidad principal (CLI/API) | ✅ Estable |
| Aplicación Windows | ✅ Funcional |
| Aplicación Android | ✅ Funcional |
| Tests | ⚠️ En progreso (45% → objetivo 80%) |
| Seguridad (issues conocidos) | ⚠️ Correcciones en progreso ([detalle](docs/security/security-audit.md)) |
| Integración IA en producto | 🔄 En desarrollo |
| Documentación técnica | 🔄 En progreso |
| Listo para producción | ❌ No todavía (v1.0.0 estimado 2027) |

> Este proyecto es un Trabajo Fin de Máster en desarrollo activo. Los issues de seguridad conocidos están documentados y priorizados. No desplegar en producción hasta la versión 1.0.0.
