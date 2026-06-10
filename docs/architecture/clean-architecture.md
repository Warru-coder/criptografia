# Arquitectura Propuesta — SecureCrypt

> Basada en Clean Architecture, DDD, SOLID, Hexagonal Architecture

---

## 1. Principios Arquitectónicos

El rediseño se basa en:
- **Clean Architecture** (Robert Martin): las capas internas no conocen las externas
- **DDD**: el dominio es el centro, los conceptos del negocio definen la estructura
- **Hexagonal Architecture** (Ports & Adapters): la lógica de negocio es agnóstica al transporte
- **SOLID**: especialmente Single Responsibility y Dependency Inversion
- **Feature Modules**: cada dominio es un módulo independiente y cohesivo

---

## 2. Dominios Identificados (DDD Bounded Contexts)

```
┌────────────────────────────────────────────────────────────┐
│                      SecureCrypt Core                       │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Crypto  │  │   Vault  │  │   Audit  │  │    AI    │  │
│  │  Domain  │  │  Domain  │  │  Domain  │  │  Domain  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                            │
│  ┌──────────┐  ┌──────────┐                               │
│  │  Storage │  │  Identity│                               │
│  │  Domain  │  │  Domain  │                               │
│  └──────────┘  └──────────┘                               │
└────────────────────────────────────────────────────────────┘
```

### Bounded Context: Crypto
**Responsabilidad**: Primitivas criptográficas puras. Sin conocimiento de archivos, UI, ni almacenamiento.
- Entidades: `EncryptedPayload`, `CryptoKey`, `KeyDerivationParams`
- Value Objects: `Salt`, `IV`, `AuthTag`, `CipherAlgorithm`
- Servicios de dominio: `EncryptionService`, `KeyDerivationService`, `IntegrityService`
- Puertos: `ICryptoProvider` (adapter pattern para diferentes backends: Node crypto, WebCrypto, CNG)

### Bounded Context: Vault
**Responsabilidad**: Gestión del vault de archivos cifrados. Ciclo de vida de documentos.
- Entidades: `VaultFile`, `VaultDirectory`, `EncryptionJob`, `DecryptionJob`
- Value Objects: `FilePath`, `OriginalName`, `FileMetadata`
- Servicios de dominio: `VaultService`, `FileEncryptionService`, `MetadataService`
- Puertos: `IVaultRepository`, `IFileSystemAdapter`, `IProgressNotifier`

### Bounded Context: Audit
**Responsabilidad**: Registro de operaciones, eventos de seguridad, alertas.
- Entidades: `AuditEvent`, `SecurityAlert`, `OperationLog`
- Value Objects: `EventType`, `Severity`, `Timestamp`, `ActorId`
- Servicios de dominio: `AuditService`, `AlertService`
- Puertos: `IAuditRepository`, `IAlertNotifier`

### Bounded Context: AI
**Responsabilidad**: Inteligencia artificial aplicada a seguridad y usabilidad.
- Entidades: `SecurityRecommendation`, `ConfigurationAnalysis`, `RiskScore`
- Servicios de dominio: `ConfigAuditorService`, `DocumentationService`, `RAGService`
- Puertos: `ILLMProvider`, `IEmbeddingProvider`, `IVectorStore`

### Bounded Context: Storage
**Responsabilidad**: Persistencia segura (passwords, notas, metadatos de vault).
- Entidades: `StoredPassword`, `SecureNote`, `VaultMetadata`
- Puertos: `IPasswordRepository`, `INoteRepository`, `ISecureDatabaseAdapter`

### Bounded Context: Identity
**Responsabilidad**: Autenticación, sesión, autorización.
- Entidades: `MasterKey`, `Session`, `BiometricCredential`
- Servicios: `AuthenticationService`, `SessionService`
- Puertos: `ISessionStore`, `IBiometricProvider`, `IKeystoreAdapter`

---

## 3. Diagrama de Capas

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                               │
│   CLI (Commander)  │  REST API (Express)  │  Win32 UI  │  Compose  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ DTOs / Request Models
┌──────────────────────────────▼──────────────────────────────────────┐
│                    APPLICATION LAYER                                │
│         Use Cases / Application Services / Command Handlers         │
│   EncryptFileUseCase  │  DecryptFileUseCase  │  AuditConfigUseCase  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Domain Interfaces (Ports)
┌──────────────────────────────▼──────────────────────────────────────┐
│                      DOMAIN LAYER                                   │
│      Entities │ Value Objects │ Domain Services │ Domain Events      │
│              (Zero external dependencies)                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Implementations (Adapters)
┌──────────────────────────────▼──────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                               │
│  CryptoAdapter(Node/CNG/WebCrypto) │ SQLiteAdapter │ LLMAdapter     │
│  FileSystemAdapter │ KeystoreAdapter │ BiometricAdapter             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Estructura de Carpetas Propuesta (Node.js — Referencia)

```
src/
├── shared/                          # Shared Kernel
│   ├── domain/
│   │   ├── errors.ts                # Base error types
│   │   ├── result.ts                # Result<T,E> monad
│   │   └── value-objects/
│   │       └── branded-types.ts    # Branded types for type safety
│   ├── infrastructure/
│   │   └── logger.ts
│   └── utils/
│       └── secure-compare.ts       # Constant-time comparison
│
├── crypto/                          # Bounded Context: Crypto
│   ├── domain/
│   │   ├── entities/
│   │   │   └── encrypted-payload.ts
│   │   ├── value-objects/
│   │   │   ├── salt.ts
│   │   │   ├── iv.ts
│   │   │   └── auth-tag.ts
│   │   ├── services/
│   │   │   ├── encryption.service.ts
│   │   │   └── key-derivation.service.ts
│   │   └── ports/
│   │       └── crypto-provider.port.ts
│   ├── application/
│   │   └── use-cases/
│   │       ├── encrypt-data.use-case.ts
│   │       └── derive-key.use-case.ts
│   └── infrastructure/
│       └── adapters/
│           └── node-crypto.adapter.ts
│
├── vault/                           # Bounded Context: Vault
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── vault-file.ts
│   │   │   └── encryption-job.ts
│   │   ├── value-objects/
│   │   │   ├── file-path.ts         # Validated, sandboxed path
│   │   │   └── file-metadata.ts
│   │   ├── services/
│   │   │   └── vault.service.ts
│   │   └── ports/
│   │       ├── vault-repository.port.ts
│   │       └── file-system.port.ts
│   ├── application/
│   │   └── use-cases/
│   │       ├── encrypt-file.use-case.ts
│   │       ├── decrypt-file.use-case.ts
│   │       └── encrypt-directory.use-case.ts
│   └── infrastructure/
│       ├── adapters/
│       │   └── local-file-system.adapter.ts  # Path validation here
│       ├── repositories/
│       │   └── sqlite-vault.repository.ts
│       └── streaming/
│           ├── file-cipher.stream.ts
│           └── file-decipher.stream.ts
│
├── identity/                        # Bounded Context: Identity
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── master-key.ts
│   │   │   └── session.ts
│   │   ├── services/
│   │   │   └── authentication.service.ts
│   │   └── ports/
│   │       └── session-store.port.ts
│   ├── application/
│   │   └── use-cases/
│   │       ├── authenticate.use-case.ts
│   │       └── refresh-session.use-case.ts
│   └── infrastructure/
│       └── adapters/
│           └── in-memory-session.adapter.ts  # Secure session store
│
├── audit/                           # Bounded Context: Audit
│   ├── domain/
│   │   ├── entities/
│   │   │   └── audit-event.ts
│   │   └── services/
│   │       └── audit.service.ts
│   └── infrastructure/
│       └── repositories/
│           └── sqlite-audit.repository.ts
│
├── ai/                              # Bounded Context: AI
│   ├── domain/
│   │   ├── entities/
│   │   │   └── security-recommendation.ts
│   │   ├── services/
│   │   │   ├── config-auditor.service.ts
│   │   │   └── rag.service.ts
│   │   └── ports/
│   │       ├── llm-provider.port.ts
│   │       └── vector-store.port.ts
│   └── infrastructure/
│       └── adapters/
│           ├── ollama.adapter.ts
│           └── claude-api.adapter.ts
│
└── presentation/                    # Presentation Layer
    ├── cli/
    │   ├── cli-parser.ts
    │   └── commands/
    │       ├── encrypt.command.ts
    │       └── decrypt.command.ts
    └── web/
        ├── server.ts
        ├── middleware/
        │   ├── auth.middleware.ts    # Session authentication
        │   ├── sandbox.middleware.ts # Path traversal prevention
        │   └── rate-limit.middleware.ts
        └── routes/
            ├── auth.routes.ts
            └── vault.routes.ts
```

---

## 5. Flujo de Datos — Cifrado de Archivo

```
User/CLI/Web Request
        │
        ▼
[Presentation Layer]
  Validates input format (Zod schema)
  Creates EncryptFileCommand DTO
        │
        ▼
[Identity — AuthMiddleware]
  Validates session token (NOT password in request body)
  Retrieves derived master key from secure session
        │
        ▼
[Application Layer — EncryptFileUseCase]
  Orchestrates the operation:
  1. Resolve and sandbox file path (Vault domain)
  2. Derive file key (Crypto domain)
  3. Create audit event (Audit domain)
  4. Execute streaming encryption (Vault infrastructure)
  5. Persist metadata (Storage domain)
  6. Emit completion event
        │
        ▼
[Domain Services]
  CryptoProvider.generateSalt() → Salt VO
  CryptoProvider.generateIV() → IV VO
  KeyDerivationService.derive(masterKey, salt, params) → CryptoKey
  EncryptionService.encrypt(inputStream, key, iv) → EncryptedStream
        │
        ▼
[Infrastructure]
  NodeCryptoAdapter implements ICryptoProvider
  LocalFileSystemAdapter validates path is within allowed sandbox
  Writes .scrypt file with standardized header
  Cleans up temp files in finally block
        │
        ▼
[Audit]
  Records: who, what file, when, success/failure, params used
```

---

## 6. Decisiones de Diseño Clave

### ADR-001: Un KDF unificado para todas las plataformas
**Decisión**: Adoptar Argon2id como estándar cross-platform. En Android usar la implementación de BouncyCastle. En Windows C++ compilar libsodium.  
**Alternativa rechazada**: Mantener KDFs distintos por plataforma.  
**Motivo**: Interoperabilidad de archivos, documentación honesta, seguridad uniforme.

### ADR-002: Sistema de sesión en lugar de contraseña por request
**Decisión**: Implementar sesión temporal (15-30 min) con token opaco. La contraseña maestra solo se envía una vez, en el login.  
**Alternativa rechazada**: Contraseña en cada request.  
**Motivo**: Eliminar CRIT-002, reducir superficie de ataque, mejor UX.

### ADR-003: Módulo compartido de rutas seguras (SecurePath VO)
**Decisión**: `FilePath` value object que en su constructor valida que la ruta esté dentro del sandbox autorizado, resolve symlinks, y rechaza path traversal.  
**Alternativa rechazada**: Validar en cada endpoint por separado.  
**Motivo**: DRY, imposible olvidarse de validar, fácil de auditar.

### ADR-004: Result<T,E> en lugar de excepciones para flujos de negocio
**Decisión**: Las operaciones de dominio devuelven `Result<T,E>` (tipo discriminado). Solo se usan excepciones para errores inesperados del sistema.  
**Motivo**: Control de flujo explícito, fácil testing, sin swallow silencioso de errores.
