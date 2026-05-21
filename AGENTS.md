# AGENTS.md — SecureCrypt AI Agent Guidelines

## Project Overview
SecureCrypt is a legitimate file encryption/decryption application built with Node.js + TypeScript. It provides CLI and Web UI interfaces for secure file operations using AES-256-GCM and Argon2id.

## Security Rules (NON-NEGOTIABLE)
- NEVER store passwords in plaintext — only Argon2id hashes
- NEVER encrypt system files (Windows directories, AppData, etc.)
- NEVER implement persistence, propagation, or AV evasion
- NEVER auto-encrypt without explicit user consent
- NEVER exfiltrate data or destroy backups
- ALWAYS use unique IV + salt per encryption operation
- ALWAYS verify integrity after encryption before deleting originals
- ALWAYS clear sensitive buffers from memory (Buffer.fill(0))
- ALWAYS require explicit user confirmation for destructive operations

## Code Conventions
- **Naming**: CamelCase for variables, functions, classes, files, and internal directories
- **TypeScript**: Strict mode enabled, no `any` types
- **Imports**: Named imports preferred, group by: node builtins → npm packages → local modules
- **Error Handling**: Use custom error classes, never swallow errors
- **Comments**: Only for complex cryptographic operations or non-obvious logic

## Architecture
```
src/
├── core/             # Config, constants, error handling
├── crypto/           # AES-256-GCM, Argon2id, key derivation, integrity
├── filesystem/       # File scanning, streaming, metadata, exclusions, directory processing
├── passwordManager/  # Password validation, secure storage, vault
├── backgroundTasks/  # Task queue, worker pool, pause/resume, scheduler
├── cli/              # CLI commands, parser, progress bar
├── web/              # Express server, routes, middleware
└── utils/            # Logger, path utilities, memory monitor
```

## Commands
```bash
npm run dev          # Run CLI in development mode
npm run dev:web      # Start web server on localhost:3000
npm run build        # Compile TypeScript
npm run start:web    # Start web server in production
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run format       # Format with Prettier
```

## Cryptographic Standards
- **Cipher**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: Argon2id (memoryCost: 65536, timeCost: 3, parallelism: 2)
- **IV**: 16 random bytes per operation (crypto.randomBytes)
- **Salt**: 16 random bytes per operation (crypto.randomBytes)
- **Auth Tag**: 16 bytes (GCM native)
- **File Format**: .scrypt extension with custom header

## Testing Requirements
- All crypto functions must have unit tests
- Integration tests for full encrypt/decrypt cycles
- Stress tests for large files and concurrent operations
- Cryptographic validation tests using known vectors

## File Extension
Encrypted files use `.scrypt` extension (e.g., `document.pdf.scrypt`)

## Secure Data Location
`%USERPROFILE%\Desktop\AppSecureData\`
- `config.json` — General configuration (non-sensitive)
- `vault/master.hash` — Argon2id hash of master password
- `metadata/` — Per-file encryption metadata
- `logs/secure.log` — Activity logs (no sensitive data)
