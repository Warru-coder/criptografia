# SecureCrypt

Secure file encryption/decryption application for Windows 10/11 built with Node.js + TypeScript.

## Features

- **AES-256-GCM** authenticated encryption with unique IV + salt per operation
- **Argon2id** key derivation (memory-hard, GPU/ASIC resistant)
- **CLI interface** with progress bars, verbose mode, and configuration
- **Web UI** on localhost:3000 with drag-and-drop and real-time progress
- **Streaming processing** for files of any size without loading into RAM
- **System file exclusions** — never encrypts critical OS files
- **Integrity verification** via GCM auth tags + HMAC-SHA256 metadata
- **Secure password storage** — never stores plaintext passwords
- **Background processing** with pause/resume support
- **Concurrent task queue** with configurable worker pool

## Quick Start

```bash
# Install dependencies
npm install

# Run in development (CLI)
npm run dev

# Start web server (localhost:3000)
npm run dev:web

# Build for production
npm run build

# Run tests
npm run test
```

## CLI Usage

```bash
# Initialize vault (first time)
node dist/cli/cliRunner.js init

# Encrypt a file
node dist/cli/cliRunner.js encrypt file -i "document.pdf"

# Decrypt a file
node dist/cli/cliRunner.js decrypt file -i "document.pdf.scrypt"

# Verify integrity
node dist/cli/cliRunner.js verify -i "document.pdf.scrypt"
```

## Web UI

Open http://localhost:3000 after running `npm run dev:web`.

- Create master password on first visit
- Drag & drop files to encrypt/decrypt
- Real-time progress via Server-Sent Events
- Activity logs dashboard

## Architecture

```
src/
├── core/          # Config, constants, error handling
├── crypto/        # AES-256-GCM, Argon2id, key derivation
├── filesystem/    # File scanning, streaming, exclusions
├── passwordManager/ # Password validation, secure storage
├── cli/           # CLI commands and parser
├── web/           # Express server and routes
└── utils/         # Logger, path utilities
```

## Cryptographic Standards

| Component | Choice |
|---|---|
| Cipher | AES-256-GCM |
| Key Derivation | Argon2id (64MB memory, 3 iterations, 2 parallel) |
| IV | 16 random bytes per operation |
| Salt | 16 random bytes per operation |
| Auth Tag | 16 bytes (GCM native) |
| File Extension | `.scrypt` |

## Security

- Passwords are never stored in plaintext
- System files are excluded from encryption
- Each file gets a unique IV and salt
- Memory buffers are zeroed after use
- Integrity is verified before deleting originals
- Explicit user confirmation required for all operations

## Project Structure

```
SecureCrypt/
├── src/
│   ├── core/
│   ├── crypto/
│   ├── filesystem/
│   ├── passwordManager/
│   ├── cli/
│   ├── web/
│   └── utils/
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── tests/
├── AGENTS.md
├── package.json
└── tsconfig.json
```

## License

MIT
