# Capítulo 4: Arquitectura del Sistema

## 4.1 Decisiones arquitectónicas

### ADR-001: Arquitectura hexagonal (Ports & Adapters)

**Decisión**: Adoptar arquitectura hexagonal para el backend web.

**Contexto**: El proyecto debe ser testeable, mantenible y extensible a múltiples plataformas (web, CLI, Windows, Android).

**Consecuencias positivas**:
- El dominio de cifrado es independiente de Express, filesystem, o cualquier framework
- Se puede testear `encryptFile()` sin iniciar el servidor web
- Añadir un nuevo adaptador (CLI, gRPC) no requiere cambios en el dominio

**Estructura de capas**:
```
Domain (src/crypto/, src/passwordManager/)
  ↑ no imports de Express/fs/etc.
Application (src/web/, src/cli/)
  ↑ orquesta el dominio usando sus ports
Infrastructure (Express, multer, SQLite, Ollama HTTP)
```

### ADR-002: Web-first, luego plataformas nativas

**Decisión**: La interfaz web es la prioridad; las apps nativas son adaptadores secundarios.

**Contexto**: El usuario final puede acceder a cualquier funcionalidad desde el navegador. Las apps nativas ofrecen integración profunda con el SO pero requieren mayor esfuerzo de desarrollo.

**Hoja de ruta**:
1. Web (Node.js/Express) — Fase 1 (actual)
2. Windows (C++/Win32) — Fase 1 parcial
3. Android (Kotlin) — Fase 2
4. Extensión VS Code — Fase 3

### ADR-003: KDF unificado en Argon2id

**Decisión**: Argon2id como único KDF soportado, con PBKDF2 detectado como configuración insegura por el auditor.

**Contexto**: El codebase original usaba PBKDF2 en algunos módulos y Argon2id en otros.

**Referencia**: OWASP Password Storage Cheat Sheet 2024 — "Use Argon2id with a minimum configuration of 19 MiB of memory, an iteration count of 2, and 1 degree of parallelism."

## 4.2 Vista de componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Client                           │
│  HTML/CSS/JS vanilla  ·  fetch API  ·  EventSource (SSE)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Web Server                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │/api/auth │  │/api/*    │  │/api/ai/* │  │ static files │   │
│  │authRoutes│  │apiRoutes │  │aiRoutes  │  │ public/      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────────┘   │
│       │            │             │                              │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼──────────────────────┐    │
│  │Session   │  │Require   │  │ configAuditor              │    │
│  │Store     │  │Session   │  │ cryptoAssistant            │    │
│  │(in-mem)  │  │Middleware│  │ ollamaProvider             │    │
│  └──────────┘  └────┬─────┘  │ cryptoKnowledge (RAG)      │    │
│                     │        └────────────────────────────┘    │
│               ┌─────▼──────────────────────────────────┐       │
│               │        Domain Layer                     │       │
│               │  encryptFile / decryptFile              │       │
│               │  encryptDirectory / decryptDirectory    │       │
│               │  setupMasterPassword / verifyPassword   │       │
│               │  validatePassword                       │       │
│               └────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 4.3 Formato de archivo .scrypt

El formato de archivo SecureCrypt (.scrypt) tiene una cabecera de 148 bytes:

```
Offset  Tamaño  Campo
──────────────────────────────────────────────────────────
0       6       Magic bytes: "SCRYPT"
6       1       Version (0x01)
7       1       Flags (reserved)
8       4       memoryCost (Argon2id) — uint32 LE
12      4       timeCost (Argon2id) — uint32 LE
16      4       parallelism (Argon2id) — uint32 LE
20      4       keyLength — uint32 LE
24      4       saltLength — uint32 LE
28      4       ivLength — uint32 LE
32      32      Salt (Argon2id)
64      12      IV/Nonce (GCM)
76      4       Payload length — uint32 LE
80      N       Ciphertext (AES-256-GCM)
80+N    16      Authentication tag (GCM, 128 bits)
```

**Propiedades de seguridad**:
- Salt único por archivo (32 bytes de entropía)
- IV único por archivo (12 bytes, NIST recomendado para GCM)
- Tag de autenticación cubre cabecera + ciphertext (AAD = cabecera)
- Los parámetros Argon2id están en la cabecera para auto-documentación

## 4.4 Flujo de cifrado

```
Usuario: contraseña P
         │
         ▼
  [1] Argon2id(P, salt, memoryCost=65536, timeCost=3, parallelism=2)
         │ → masterKey (32 bytes)
         ▼
  [2] Generar IV (12 bytes aleatorios con crypto.randomBytes)
         │
         ▼
  [3] AES-256-GCM streaming:
      createCipheriv('aes-256-gcm', masterKey, IV)
      setAAD(header)  // autentica la cabecera
      while (chunk = read()) {
        write(cipher.update(chunk))
      }
      write(cipher.final())
      authTag = cipher.getAuthTag()  // 16 bytes
         │
         ▼
  [4] Escribir: magic + version + params + salt + IV + ciphertext + authTag
         │
         ▼
  [5] Limpiar masterKey de memoria: masterKey.fill(0)
```

## 4.5 Flujo de autenticación web

```
Browser          Express             SessionStore         Domain
   │                │                    │                  │
   │ POST /login    │                    │                  │
   │─────────────→  │                    │                  │
   │                │ verifyPassword()   │                  │
   │                │────────────────────────────────────→  │
   │                │ ← ok               │                  │
   │                │                    │                  │
   │                │ getMasterKey()     │                  │
   │                │────────────────────────────────────→  │
   │                │ ← masterKey (32B)  │                  │
   │                │                    │                  │
   │                │ createSession(key) │                  │
   │                │───────────────→    │                  │
   │                │ ← token (64 hex)   │                  │
   │                │                    │                  │
   │                │ masterKey.fill(0)  │                  │
   │                │                    │                  │
   │ {token, exp}   │                    │                  │
   │←─────────────  │                    │                  │
   │                │                    │                  │
   │ POST /encrypt  │                    │                  │
   │ Bearer: token  │                    │                  │
   │─────────────→  │                    │                  │
   │                │ getSession(token)  │                  │
   │                │───────────────→    │                  │
   │                │ ← {masterKey, ...} │                  │
   │                │                    │                  │
   │                │ encryptFile(masterKey)                │
   │                │────────────────────────────────────→  │
   │                │ ← encrypted data   │                  │
   │                │                    │                  │
   │ .scrypt file   │                    │                  │
   │←─────────────  │                    │                  │
```

## 4.6 Arquitectura del sistema RAG

```
Consulta del usuario
        │
        ▼
  searchKnowledge(query, topK=3)
        │
        ├─ Tokenización: split en palabras normalizadas
        ├─ TF-IDF scoring: frecuencia × log(N/df)
        ├─ Ranking de chunks por score descendente
        └─ Top 3 chunks seleccionados
              │
              ▼
  buildContext(chunks)
        │ → "[chunk_id] título\ncontenido\nFuente: ..."
        ▼
  isOllamaAvailable() ?
    ├─ Sí → chat([context + question], SYSTEM_PROMPT)
    │         → Respuesta LLM fundamentada en documentos
    └─ No → templateAnswer(question, chunks)
              → Respuesta determinista con top chunk

  Respuesta final:
    { answer, sources: [{id, title, source}], usedAI, model? }
```

## 4.7 Estructura de directorios

```
securecrypt/
├── src/
│   ├── ai/
│   │   ├── knowledge/      # Base de conocimiento RAG (15 chunks)
│   │   ├── providers/      # Ollama HTTP client
│   │   └── services/       # configAuditor, cryptoAssistant
│   ├── cli/                # Commander.js CLI
│   ├── core/               # Constantes, error types, appConfig
│   ├── crypto/             # fileCipher, fileDecipher
│   ├── filesystem/         # directoryProcessor
│   ├── passwordManager/    # secureStorage, passwordValidator
│   ├── utils/              # logger
│   └── web/
│       ├── middleware/     # requireSession, pathSandbox, errorMiddleware
│       ├── routes/         # apiRoutes, authRoutes, aiRoutes, pageRoutes
│       ├── session/        # sessionStore
│       └── server.ts
├── public/                 # Frontend estático (HTML/CSS/JS)
├── apps/
│   ├── windows/            # App nativa Win32 (C++)
│   └── android/            # App nativa Android (Kotlin)
├── tests/                  # Tests unitarios e integración
├── docs/                   # Documentación de arquitectura y decisiones
├── tfm/                    # Este directorio
└── opencode.json           # Configuración AI dev tools
```
