# SecureCrypt Windows

**Native C++ Password & Document Vault for Windows**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue.svg)](https://www.microsoft.com/windows)
[![C++](https://img.shields.io/badge/C%2B%2B-20-blue.svg)](https://isocpp.org/)
[![CMake](https://img.shields.io/badge/CMake-3.20%2B-green.svg)](https://cmake.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

### Password Manager
- Store and manage passwords with AES-256-GCM encryption
- Strong password generator (24+ characters, customizable)
- Password strength validation with real-time feedback
- Secure clipboard with auto-clear (30 seconds)
- Categories, favorites, and tags
- Full-text search

### Secure Document Vault
- Encrypt any file type with AES-256-GCM
- Streaming encryption for large files (no RAM limits)
- Integrity verification via HMAC-SHA256
- Secure export with original file restoration
- File metadata tracking

### Secure Notes
- Encrypted note storage
- Tag-based organization
- Favorites system
- Quick search

### Security Features
- **Windows CNG** - Native cryptographic API (BCrypt)
- **DPAPI** - Data Protection API for key storage
- **Anti-Debug** - Debugger detection and prevention
- **Secure Memory** - Locked, non-pageable memory for secrets
- **Secure Clipboard** - Auto-clear with monitoring
- **Single Instance** - Mutex-based process protection
- **No Telemetry** - Zero data leaves your machine
- **Code Signing Ready** - Authenticode support

---

## Architecture

```
src/
├── app/
│   ├── main.cpp                    # Entry point (wWinMain)
│   └── AppController.cpp/.h        # Application lifecycle
├── core/
│   ├── crypto/
│   │   ├── CryptoEngine.cpp/.h     # AES-256-GCM via BCrypt
│   │   ├── KeyManager.cpp/.h       # DPAPI key storage
│   │   ├── FileCipher.cpp/.h       # Streaming file encryption
│   │   └── PasswordGenerator.cpp/.h # Password generation & validation
│   ├── security/
│   │   ├── SecureMemory.cpp/.h     # Locked memory management
│   │   ├── AntiDebug.cpp/.h        # Anti-debugging techniques
│   │   └── ClipboardManager.cpp/.h # Secure clipboard operations
│   ├── storage/
│   │   ├── SecureDatabase.cpp/.h   # SQLite encrypted database
│   │   └── StorageManager.cpp/.h   # File system management
│   └── utils/
│       ├── Logger.cpp/.h           # Secure logging
│       ├── StringUtils.cpp/.h      # String utilities
│       └── PathUtils.cpp/.h        # Path operations
├── data/
│   ├── model/
│   │   └── Models.cpp/.h           # Data structures
│   └── repository/
│       ├── PasswordRepository.cpp/.h
│       ├── DocumentRepository.cpp/.h
│       └── NoteRepository.cpp/.h
└── ui/
    ├── MainWindow.cpp/.h           # Main application window
    ├── ResourceLoader.cpp/.h       # Resource management
    ├── dialogs/
    │   ├── AuthDialog.cpp/.h       # Authentication dialog
    │   ├── PasswordDialog.cpp/.h   # Password add/edit dialog
    │   ├── DocumentDialog.cpp/.h   # Document import/export
    │   └── SettingsDialog.cpp/.h   # Settings panel
    └── controls/
        ├── ModernButton.cpp/.h     # Custom styled button
        └── SecureInput.cpp/.h      # Secure password input
```

---

## Cryptographic Standards

| Component | Implementation |
|-----------|---------------|
| Cipher | AES-256-GCM (Windows CNG/BCrypt) |
| Key Derivation | PBKDF2-SHA256 (100,000 iterations) |
| Key Storage | Windows DPAPI + CryptProtectData |
| Random | BCryptGenRandom (system CSP) |
| IV | 16 bytes per operation |
| Salt | 16 bytes per derivation |
| Auth Tag | 128 bits (GCM native) |
| HMAC | HMAC-SHA256 for file integrity |
| Memory | VirtualLock + SecureZeroMemory |

---

## Requirements

- **OS**: Windows 10 (1809+) or Windows 11
- **Compiler**: MSVC 19.30+ (Visual Studio 2022)
- **CMake**: 3.20 or later
- **Windows SDK**: 10.0.19041.0 or later
- **RAM**: 256 MB minimum
- **Disk**: 50 MB for application + storage for encrypted data

---

## Build Instructions

### 1. Clone the Repository

```cmd
cd criptografia-app-windows
```

### 2. Install Dependencies

- **Visual Studio 2022** with "Desktop development with C++" workload
- **CMake 3.20+** (or use Visual Studio's built-in CMake)
- **Windows SDK** (included with VS2022)

### 3. Build with Script

```cmd
build.bat
```

### 4. Build with CMake (Manual)

```cmd
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release --parallel
```

### 5. Build Installer

```cmd
build-installer.bat
```

Requires [Inno Setup 6](https://jrsoftware.org/isdl.php)

---

## Security Configuration

### Release Build Security Flags

The CMake configuration enables the following security features:

```cmake
/W4              # Warning level 4
/WX              # Warnings as errors
/permissive-     # Strict conformance
/sdl             # Security Development Lifecycle checks
/guard:cf        # Control Flow Guard
/DYNAMICBASE     # ASLR
/HIGHENTROPYVA   # High-entropy ASLR (64-bit)
/NXCOMPAT        # DEP (Data Execution Prevention)
/O2              # Optimization
/GL              # Whole program optimization
/Gy              # Function-level linking
/GS              # Buffer security check
/LTCG            # Link-time code generation
```

### Runtime Security

- **Anti-Debug**: Thread hiding, debugger detection via PEB
- **Secure Memory**: VirtualLock prevents paging to disk
- **DPAPI**: Keys encrypted with user-specific machine key
- **Single Instance**: Mutex prevents multiple copies
- **Secure Delete**: 3-pass overwrite before file deletion

---

## Usage

### First Run

1. Launch `SecureCrypt.exe`
2. Create a master password (minimum 12 characters)
3. Keys are automatically generated and stored via DPAPI

### Daily Use

1. Enter master password to unlock
2. Add passwords, documents, or notes
3. App auto-locks after inactivity
4. Click "Lock" to manually lock

### File Encryption

1. Drag & drop files or use "Import Document"
2. Files are encrypted with AES-256-GCM
3. Original files are securely deleted
4. Export to decrypt and save elsewhere

---

## File Format

Encrypted files use the `.scrypt` extension with this structure:

```
Offset  Size    Description
------  ----    -----------
0       6       Magic bytes: "SCRYPT"
6       1       Version byte (0x01)
7       16      Salt (random)
23      16      IV (random)
39      N       Encrypted data (AES-256-GCM)
N       16      GCM authentication tag
```

---

## Testing

```cmd
cd build
ctest -C Release --output-on-failure
```

### Test Suites

- `CryptoTests` - AES-256-GCM encryption/decryption
- `MemoryTests` - Secure memory operations
- `PasswordTests` - Password generation and validation
- `DatabaseTests` - SQLite operations
- `FileCipherTests` - File encryption/decryption

---

## Dependencies

| Library | Purpose | License |
|---------|---------|---------|
| Windows CNG (BCrypt) | Cryptographic operations | Microsoft |
| Windows DPAPI | Key protection | Microsoft |
| SQLite3 | Database engine | Public Domain |
| SQLCipher | Database encryption | BSD |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new code
4. Ensure all security checks pass
5. Submit a pull request

### Code Style

- Follow Microsoft C++ Core Guidelines
- Use RAII for resource management
- Never use raw pointers for ownership
- Always use `SecureZeroMemory` for sensitive data
- Validate all inputs

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Windows Cryptography API: Next Generation](https://docs.microsoft.com/en-us/windows/win32/seccng/cng-portal)
- [Data Protection API](https://docs.microsoft.com/en-us/windows/win32/seccrypto/data-protection-api)
- [SQLite](https://www.sqlite.org/)
- [SQLCipher](https://www.zetetic.net/sqlcipher/)
- [Inno Setup](https://jrsoftware.org/isinfo.php)

---

## Security Contact

For security vulnerabilities, please email: security@securecrypt.com

Please do NOT open public issues for security vulnerabilities.

---

*Built with security in mind. Native C++ for maximum performance.*
