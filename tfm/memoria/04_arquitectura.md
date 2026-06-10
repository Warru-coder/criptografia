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
1. Web (Node.js/Express) — Fase 1 y Fase 2 (actual)
2. Windows (C++/Win32) — Fase futura
3. Android (Kotlin) — Fase futura

### ADR-003: KDF unificado en Argon2id

**Decisión**: Argon2id como único KDF soportado, con PBKDF2 detectado como configuración insegura por el auditor.

**Referencia**: OWASP Password Storage Cheat Sheet 2024 — "Use Argon2id with a minimum configuration of 19 MiB of memory, an iteration count of 2, and 1 degree of parallelism."

### ADR-004: Config centralizada en `.env`

**Decisión**: Toda la configuración de despliegue reside en un único archivo `.env`. Para pasar de desarrollo local a hosting, solo se modifica ese archivo.

**Variables clave de producción**:
```
SERVER_SECRET=<hex 64 chars>   # obligatorio en producción
RP_ID=tudominio.com
RP_ORIGIN=https://tudominio.com
TRUST_PROXY=true
NODE_ENV=production
```

### ADR-005: Multi-usuario con vault por usuario

**Decisión**: Cada usuario tiene su propio vault en `{dataDir}/users/{userId}/vault/master.hash`. El hash Argon2id permite verificar la contraseña y derivar la clave maestra sin almacenar la clave en disco.

**Seguridad**: La clave maestra nunca se persiste. Solo vive en RAM durante la sesión.

### ADR-006: Sesiones híbridas SQLite + memoria

**Decisión**: Los metadatos de sesión (token, userId, expiresAt) se persisten en SQLite para sobrevivir reinicios del proceso. La clave maestra solo vive en un Map en memoria.

**Consecuencia**: Tras un reinicio del servidor, el usuario debe volver a hacer login para recargar su clave maestra en memoria.

### ADR-007: WebAuthn como segundo factor de login

**Decisión**: Los usuarios que ya tienen sesión pueden registrar passkeys FIDO2. Login posterior con passkey no requiere contraseña.

**Mecanismo de recuperación de clave**: Al registrar la passkey, la clave maestra se cifra con `SERVER_SECRET` (AES-256-GCM) y se guarda como `wrappedKey` en la tabla `users`. En el login con passkey, se descifra para reconstruir la sesión.

## 4.2 Vista de componentes (Fase 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Client                           │
│  HTML/CSS/JS vanilla  ·  fetch API  ·  WebAuthn API             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (nginx → localhost:3000)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Web Server                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │/api/auth │  │/api/*    │  │/api/ai/* │  │ static files │   │
│  │authRoutes│  │apiRoutes │  │aiRoutes  │  │ public/      │   │
│  │webauthn  │  │          │  │          │  │              │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────────┘   │
│       │            │             │                              │
│  ┌────▼─────────────────────┐  ┌──▼────────────────────────┐   │
│  │  Session Store           │  │  AI Services               │   │
│  │  SQLite (token,userId)   │  │  configAuditor             │   │
│  │  Memory Map (masterKey)  │  │  cryptoAssistant           │   │
│  └──────────────────────────┘  │  ollamaProvider            │   │
│                                │  cryptoKnowledge (RAG)     │   │
│  ┌────────────────────────┐    └────────────────────────────┘   │
│  │  SQLite Database        │                                    │
│  │  users                  │                                    │
│  │  sessions               │                                    │
│  │  webauthn_credentials   │                                    │
│  └────────────────────────┘                                    │
│                                                                 │
│               ┌─────────────────────────────────┐              │
│               │        Domain Layer              │              │
│               │  encryptFile / decryptFile       │              │
│               │  encryptDirectory               │              │
│               │  setupMasterPassword (per-user) │              │
│               │  verifyMasterPassword           │              │
│               │  validatePassword               │              │
│               └─────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 4.3 Formato de archivo .scrypt

El formato de archivo SecureCrypt (.scrypt) tiene una cabecera de 128 bytes seguida del ciphertext y el auth tag:

```
Offset  Tamaño  Campo
──────────────────────────────────────────────────────────
0       6       Magic bytes: "SCRYPT"
6       1       Version (0x01)
7       16      Salt (Argon2id)
23      16      IV/Nonce (AES-GCM)
39      4       memoryCost — uint32 LE
43      1       timeCost — uint8
44      1       parallelism — uint8
45      8       reservado
53      2       filename length — uint16 LE
55      N       filename (UTF-8)
55+N    8       originalSize — uint64 LE
...     ...     padding to 128 bytes
128     ...     Ciphertext (AES-256-GCM)
EOF-16  16      Authentication tag (GCM, 128 bits)
```

## 4.4 Flujo de cifrado

```
Usuario: contraseña P
         │
         ▼
  [1] Argon2id(P, salt, memoryCost=65536, timeCost=3, parallelism=2)
         │ → masterKey (32 bytes)
         ▼
  [2] Generar IV (16 bytes aleatorios con crypto.randomBytes)
         │
         ▼
  [3] AES-256-GCM streaming:
      createCipheriv('aes-256-gcm', masterKey, IV)
      while (chunk = read()) { write(cipher.update(chunk)) }
      write(cipher.final())
      authTag = cipher.getAuthTag()  // 16 bytes
         │
         ▼
  [4] Escribir: header (128B) + ciphertext + authTag
         │
         ▼
  [5] Limpiar masterKey de memoria: masterKey.fill(0)
```

## 4.5 Flujo de autenticación — Password

```
Browser          Express             SessionStore (SQLite+Mem)   Domain
   │                │                    │                          │
   │ POST /register │                    │                          │
   │─────────────→  │ createUser()       │                          │
   │                │ setupMasterPassword(userId, password)         │
   │                │──────────────────────────────────────────→    │
   │                │ getMasterKey(userId, password) → masterKey    │
   │                │ createSession(masterKey, userId)              │
   │                │───────────────→   ├─persist(SQLite)           │
   │                │                   └─mem.set(token, key)       │
   │ {token, userId}│                                               │
   │←─────────────  │                                               │
   │                │                                               │
   │ POST /encrypt  │                                               │
   │ Bearer: token  │                                               │
   │─────────────→  │ getSession(token)                             │
   │                │───────────────→   ├─touchSession(SQLite)      │
   │                │                   └─mem.get(token) → key      │
   │                │ encryptFile(masterKey)                        │
   │                │──────────────────────────────────────────→    │
   │ .scrypt file   │                                               │
   │←─────────────  │                                               │
```

## 4.6 Flujo de autenticación — WebAuthn (Passkey)

```
Browser          Express             WebAuthn Server
   │                │                    │
   │ POST /webauthn/registration-options │
   │─────────────→  │ generateRegOptions  │
   │                │────────────────→   │
   │ options        │                    │
   │←─────────────  │                    │
   │ navigator.credentials.create(opt)   │
   │←── hardware authenticator          │
   │ credential                          │
   │ POST /webauthn/registration-verify  │
   │─────────────→  │ verifyRegistration  │
   │                │────────────────→   │
   │                │ saveCredential(DB) │
   │                │ wrapMasterKey →    │
   │                │ users.wrappedKey   │
   │ {verified:true}│                    │
   │←─────────────  │                    │
   │                                     │
   │ (Posterior login con passkey)       │
   │ POST /webauthn/authentication-verify│
   │─────────────→  │ verifyAuthentication│
   │                │────────────────→   │
   │                │ unwrapMasterKey    │
   │                │ createSession()    │
   │ {sessionToken} │                    │
   │←─────────────  │                    │
```

## 4.7 Arquitectura del sistema RAG

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
  isOllamaAvailable() ?
    ├─ Sí → chat([context + question], SYSTEM_PROMPT) → LLM response
    └─ No → templateAnswer(question, chunks) → respuesta determinista

  Respuesta final:
    { answer, sources: [{id, title, source}], usedAI, model? }
```

## 4.8 Despliegue

### Local (desarrollo)
```bash
cp .env.example .env
# editar .env con SERVER_SECRET generado
npm install
npm run dev:web
# → http://localhost:3000
```

### Docker
```bash
docker compose up -d
# datos persistentes en volumen Docker securecrypt_data
```

### Hosting (VPS/Cloud)
Cambiar en `.env`:
```
NODE_ENV=production
SERVER_SECRET=<hex 64 chars — obligatorio>
RP_ID=tudominio.com
RP_ORIGIN=https://tudominio.com
TRUST_PROXY=true
```
Añadir nginx como reverse proxy usando `nginx.conf.example`.

## 4.9 Estructura de directorios

```
securecrypt/
├── .env.example            # Plantilla de config (único fichero a editar para deploy)
├── .env                    # Config local (gitignored)
├── Dockerfile              # Build multi-etapa Node.js 20 Alpine
├── docker-compose.yml      # Servicio + volumen de datos
├── nginx.conf.example      # Reverse proxy con SSL
├── src/
│   ├── config.ts           # Config centralizada — lee .env
│   ├── ai/                 # AI: RAG, auditor, Ollama provider
│   ├── cli/                # Commander.js CLI
│   ├── core/               # Constantes, error types
│   ├── crypto/             # fileCipher, fileDecipher, engine
│   ├── database/           # SQLite: db.ts, userRepo, sessionRepo, webauthnRepo
│   ├── filesystem/         # directoryProcessor, fileMetadata
│   ├── passwordManager/    # secureStorage (multi-user), passwordValidator
│   ├── utils/              # logger (winston)
│   └── web/
│       ├── middleware/     # requireSession, pathSandbox, errorMiddleware
│       ├── routes/         # apiRoutes, authRoutes, webauthnRoutes, aiRoutes
│       ├── session/        # sessionStore (SQLite + memoria)
│       └── server.ts       # Entry point web
├── public/                 # Frontend estático (HTML/CSS/JS vanilla)
├── tests/                  # Tests unitarios e integración
└── tfm/                    # Documentación académica TFM
```
