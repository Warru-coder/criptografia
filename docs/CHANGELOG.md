# SecureCrypt Changelog

## [0.3.0] - 2025-05-20

### Added
- Hacker-themed UI with matrix rain canvas animation
- Glitch text effect on title with CSS animations
- Terminal-style log viewer with monospace font and scroll
- Real-time encryption speed meter (MB/s)
- Elapsed time display during operations
- Scanline overlay and vignette effect
- Pulsing status indicator dot
- Password strength color coding (weak=red, moderate=yellow, strong=green, very-strong=cyan)
- OpenCode lead-developer agent with auto-documentation workflow
- OpenCode security-audit skill with quick audit commands
- CHANGELOG.md with structured version history
- Security supervisor auto-review process

### Changed
- Complete UI redesign: dark hacker theme with green-on-black terminal aesthetic
- Progress bar now shows gradient glow effect
- File list items styled as terminal entries
- Buttons with hover glow effects
- Log entries prefixed with "> " terminal prompt style

### Fixed
- (No bug fixes in this release)

### Security
- No security-relevant code changes (UI-only updates)
- All crypto operations unchanged

### Reviewed by
- security-supervisor: PASS — UI changes contain no security-sensitive code

---

## [0.2.0] - 2025-05-20

### Added
- Directory encryption/decryption (CLI + Web)
- Batch file processing command
- Configuration management (get/set/reset)
- Checkpoint system for interrupted operations
- Worker pool for parallel processing
- Task queue with priority and concurrency control
- Pause/resume controller
- GitHub Actions CI/CD pipeline
- Windows packaging via @yao-pkg/pkg
- Graceful shutdown with signal handlers
- File integrity verification endpoint
- Real-time progress via Server-Sent Events
- OpenCode agents: security-supervisor, lead-developer
- OpenCode skills: securecrypt-crypto, securecrypt-testing, securecrypt-architecture, security-audit

### Fixed
- Decryption crash on empty files (start > end in readStream)
- Web file streaming now uses pipeline instead of loading full file into memory
- Test timeout for small files stress test

### Security
- Helmet middleware active on all web routes
- Rate limiting: 100 requests per 15 minutes
- No hardcoded secrets in codebase
- All sensitive buffers cleared via secureClear()
- Argon2id with 64MB memory cost
- System file exclusions for Windows critical paths
- Auth tag verification on all decryption operations

### Reviewed by
- security-supervisor: APPROVED (2 medium-priority suggestions for streaming hash optimization)

---

## [0.1.0] - 2025-05-20

### Added
- Initial project setup with Node.js + TypeScript
- AES-256-GCM file encryption/decryption
- Argon2id key derivation
- Master password vault
- CLI interface (init, encrypt file, decrypt file)
- Web UI on localhost:3000
- Password validation and strength scoring
- File metadata storage
- System file exclusions
- Streaming encryption for large files
- Unit + integration + stress tests (25 passing)

### Security
- AES-256-GCM authenticated encryption
- Unique IV + salt per operation
- Passwords stored as Argon2id hashes only
- Memory cleanup on all sensitive buffers
- Custom error classes (no swallowed errors)
