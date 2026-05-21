---
name: securecrypt-architecture
description: Use when working on SecureCrypt's architecture, adding new modules, understanding module responsibilities, or making structural changes. Use ONLY when modifying project structure, adding features across modules, or reviewing architecture decisions.
---

# SecureCrypt Architecture Reference

## Project Root

```
SecureCrypt/
├── src/                    # TypeScript source (CamelCase naming)
├── public/                 # Static web assets (HTML, CSS, JS)
├── tests/                  # Vitest test suites
├── .opencode/              # opencode skills and config
├── AGENTS.md               # AI agent guidelines
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Module Responsibilities

### src/core/
| File | Purpose |
|---|---|
| `constants.ts` | Magic bytes, crypto parameters, file format constants, system exclusion patterns |
| `appConfig.ts` | Config loading/saving, AppSecureData directory management, zod schema validation |
| `errorHandler.ts` | Custom error classes: SecureCryptError, CryptoError, PasswordError, FileError, ValidationError |

### src/crypto/
| File | Purpose |
|---|---|
| `cryptoUtils.ts` | generateSalt(), generateIv(), deriveKey(), deriveKeyForStorage(), verifyPassword(), secureClear() |
| `keyDerivation.ts` | deriveFileKey(), deriveMasterKey() — Argon2id with configurable params |
| `fileCipher.ts` | encryptFile() — streaming AES-256-GCM with progress callbacks |
| `fileDecipher.ts` | decryptFile() — streaming AES-256-GCM with auth tag verification |

### src/filesystem/
| File | Purpose |
|---|---|
| `fileScanner.ts` | scanDirectory(), isExcluded(), getOutputPath() — recursive file discovery |
| `streamHandler.ts` | createReadStream(), createWriteStream(), pipeStreams() — stream utilities |
| `systemExclusions.ts` | exclusionRules, isCriticalSystemPath() — Windows system path protection |
| `fileMetadata.ts` | buildHeader(), readHeader(), writeMetadata(), readMetadata() — .scrypt file format |

### src/passwordManager/
| File | Purpose |
|---|---|
| `passwordValidator.ts` | validatePassword(), getPasswordStrength() — password rules and scoring |
| `secureStorage.ts` | setupMasterPassword(), verifyMasterPassword(), getMasterKey(), isVaultInitialized() |

### src/cli/
| File | Purpose |
|---|---|
| `cliRunner.ts` | Entry point — creates parser and runs |
| `cliParser.ts` | Commander.js setup — init, encrypt, decrypt, verify commands |
| `progressBar.ts` | cli-progress wrapper for console progress bars |
| `commands/init.ts` | Vault initialization with password prompt |
| `commands/encryptFile.ts` | Single file encryption CLI command |
| `commands/decryptFile.ts` | Single file decryption CLI command |

### src/web/
| File | Purpose |
|---|---|
| `server.ts` | Express app setup — helmet, rate limiting, static files, routes |
| `routes/apiRoutes.ts` | POST /api/init, /api/verify-password, /api/encrypt, /api/decrypt, GET /api/progress (SSE) |
| `routes/pageRoutes.ts` | GET / — serves index.html |
| `middleware/authMiddleware.ts` | requireVault() — checks vault initialization |
| `middleware/errorMiddleware.ts` | Global error handler |

### src/utils/
| File | Purpose |
|---|---|
| `logger.ts` | Winston logger — file logs to AppSecureData/logs/secure.log |

### public/
| File | Purpose |
|---|---|
| `index.html` | Single-page web UI — setup, login, dashboard, drop zone |
| `css/styles.css` | Dark theme styling |
| `js/app.js` | Frontend logic — file upload, SSE progress, download handling |

## Data Flow

```
CLI:  user input → cliParser → command handler → verify password → crypto operation → file output
Web:  browser → Express → multer upload → verify password → crypto operation → blob download
```

## Secure Data Location

`%USERPROFILE%\Desktop\AppSecureData\`
- `config.json` — non-sensitive configuration
- `vault/master.hash` — Argon2id hash of master password (for verification only)
- `metadata/*.meta.json` — per-file encryption metadata
- `logs/secure.log` — activity logs (no passwords or keys)

## Naming Convention

- **ALL** variables, functions, classes, files, and internal directories use **CamelCase**
- No snake_case, no kebab-case in code
- TypeScript strict mode, no `any` types

## Commands

```bash
npm run dev          # CLI via tsx
npm run dev:web      # Web server on :3000
npm run build        # tsc compile
npm run start:web    # Production web server
npm run test         # vitest run
npm run lint         # eslint
npm run format       # prettier
```
