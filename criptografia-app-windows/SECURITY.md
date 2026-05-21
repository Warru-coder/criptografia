# SecureCrypt Windows - Security Policies

## Overview

This document outlines the comprehensive security policies implemented in SecureCrypt Windows. These policies exceed standard security requirements and follow Microsoft's Security Development Lifecycle (SDL) best practices.

---

## 1. Cryptographic Standards

### 1.1 Encryption Algorithm
- **Cipher**: AES-256-GCM (Authenticated Encryption)
- **API**: Windows CNG (BCrypt) - BCryptEncrypt/BCryptDecrypt
- **Key Size**: 256 bits
- **Mode**: GCM (Galois/Counter Mode)
- **Authentication Tag**: 128 bits
- **IV Size**: 16 bytes (128 bits), randomly generated via BCryptGenRandom

### 1.2 Key Derivation
- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 100,000 (exceeds OWASP recommendation of 600,000 for SHA-256)
- **Salt**: 16 random bytes per derivation
- **Output Key Length**: 256 bits

### 1.3 Key Storage
- **Primary**: Windows DPAPI (CryptProtectData/CryptUnprotectData)
- **Scope**: Current user, machine-bound
- **Properties**:
  - Keys encrypted with user-specific key
  - Tied to Windows login credentials
  - Non-exportable outside user context
  - Protected by Windows security boundary

### 1.4 Random Number Generation
- **Source**: BCryptGenRandom with BCRYPT_USE_SYSTEM_PREFERRED_RNG
- **CSP**: System default cryptographic provider
- **Entropy**: Hardware RNG when available (RdRand on Intel)

---

## 2. Memory Security

### 2.1 Secure Memory Allocation
```cpp
// All sensitive data allocated with:
VirtualAlloc(..., PAGE_READWRITE | PAGE_NOCACHE)
VirtualLock(ptr, size)  // Prevents paging to disk
```

### 2.2 Secure Zeroing
```cpp
// All sensitive buffers cleared with:
SecureZeroMemory(ptr, size)  // Compiler cannot optimize away
volatile BYTE* p = (volatile BYTE*)ptr;  // Additional barrier
for (size_t i = 0; i < size; ++i) p[i] = 0;
```

### 2.3 Memory Protection
- **VirtualLock**: Prevents sensitive data from being paged to disk
- **PAGE_NOCACHE**: Prevents CPU cache side-channel attacks
- **SecureZeroMemory**: Guaranteed zeroing (not optimized away)
- **shrink_to_fit**: Releases unused vector capacity

### 2.4 Data Lifecycle
1. Allocate with VirtualAlloc + VirtualLock
2. Use for cryptographic operations
3. SecureZeroMemory before release
4. VirtualUnlock + VirtualFree

---

## 3. Anti-Debug Protection

### 3.1 Detection Methods
| Method | Description |
|--------|-------------|
| IsDebuggerPresent | Windows API check |
| CheckRemoteDebuggerPresent | Kernel-level check |
| NtGlobalFlag | PEB flag inspection |
| Heap Flags | Heap corruption flags |
| ProcessDebugFlags | NtQueryInformationProcess |
| DebugPort | NtQueryInformationProcess (class 7) |
| NtSetInformationThread | Thread hiding |

### 3.2 Response
- Application refuses to run if debugger detected
- Thread hiding via NtSetInformationThread
- No error details exposed to potential attacker

### 3.3 Anti-VM Detection
- Checks for VirtualBox, VMware, Hyper-V indicators
- Registry inspection for virtual hardware
- DLL inspection for virtualization libraries

---

## 4. Application Security

### 4.1 Single Instance
- Named mutex prevents multiple copies
- Existing instance brought to foreground
- Prevents race conditions and data corruption

### 4.2 Process Protection
```xml
<!-- Manifest security settings -->
<requestedExecutionLevel level="asInvoker" uiAccess="false"/>
<dpiAware>true/pm</dpiAware>
<heapType>SegmentHeap</heapType>
```

### 4.3 Compile-Time Security
| Flag | Purpose |
|------|---------|
| /GS | Buffer security check (stack cookies) |
| /guard:cf | Control Flow Guard |
| /DYNAMICBASE | ASLR (Address Space Layout Randomization) |
| /HIGHENTROPYVA | High-entropy ASLR (64-bit) |
| /NXCOMPAT | DEP (Data Execution Prevention) |
| /sdl | Security Development Lifecycle checks |
| /WX | Warnings as errors |
| /permissive- | Strict C++ conformance |

### 4.4 Runtime Security
- **DEP**: No code execution from data pages
- **ASLR**: Randomized memory layout
- **CFG**: Validated indirect calls
- **Stack Cookies**: Buffer overflow detection
- **SafeSEH**: Structured exception handler validation

---

## 5. File Security

### 5.1 Encrypted File Format
```
[6 bytes: Magic "SCRYPT"]
[1 byte: Version]
[16 bytes: Salt]
[16 bytes: IV]
[Variable: Encrypted data]
[16 bytes: GCM auth tag]
```

### 5.2 Streaming Encryption
- Buffer size: 1MB (configurable)
- No file loaded entirely into RAM
- Suitable for files of any size
- Progress callback for UI feedback

### 5.3 Secure File Deletion
```cpp
// 3-pass overwrite before deletion:
Pass 1: Write 0x00 to all bytes
Pass 2: Write 0xFF to all bytes
Pass 3: Write 0x00 to all bytes
FlushFileBuffers()
SetEndOfFile()
DeleteFile()
```

### 5.4 Integrity Verification
- HMAC-SHA256 computed over encrypted data
- Verified before decryption
- Tampered files rejected with error

---

## 6. Clipboard Security

### 6.1 Auto-Clear
- Passwords copied to clipboard auto-clear after 30 seconds
- User notified of clipboard risk
- Background thread handles clearing

### 6.2 Monitoring
- Optional clipboard change monitoring
- Alerts when clipboard content changes
- Prevents clipboard hijacking

### 6.3 Best Practice
- Recommend auto-fill over copy/paste
- Clear clipboard after each use
- Never store clipboard history

---

## 7. Database Security

### 7.1 SQLite Configuration
```sql
PRAGMA journal_mode=WAL;      -- Write-ahead logging
PRAGMA secure_delete=ON;      -- Zero deleted data
PRAGMA cipher_page_size=4096; -- SQLCipher page size
PRAGMA kdf_iter=256000;       -- Key derivation iterations
PRAGMA cipher=hmac_sha256;    -- HMAC-SHA256 integrity
```

### 7.2 Encryption
- SQLCipher AES-256-CBC for database
- Separate key from file encryption key
- Key derived from master password

### 7.3 Access Control
- Database file permissions restricted to current user
- No world-readable permissions
- ACL set via SetFileSecurity

---

## 8. Threat Model

### 8.1 Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| Memory scraping | VirtualLock + SecureZeroMemory |
| Debugger analysis | Anti-debug checks + thread hiding |
| File recovery | 3-pass secure deletion |
| Key extraction | DPAPI + user-bound encryption |
| Clipboard hijacking | Auto-clear + monitoring |
| Buffer overflow | /GS + SafeSEH + CFG |
| Code injection | DEP + ASLR + CFG |
| DLL hijacking | Known DLLs + Safe DLL search |
| Multiple instances | Named mutex |
| VM analysis | VM detection checks |

### 8.2 Residual Risks

| Risk | Notes |
|------|-------|
| Physical access with coercion | User may be forced to unlock |
| Kernel-level rootkit | Beyond user-mode protection |
| Nation-state attacks | Advanced persistent threats |
| Zero-day Windows exploits | OS-level vulnerabilities |
| Supply chain compromise | Build system integrity |

---

## 9. Compliance

### 9.1 Standards Alignment
- **NIST SP 800-132**: PBKDF2 recommendations
- **NIST SP 800-38D**: GCM mode specification
- **NIST SP 800-57**: Key management
- **Microsoft SDL**: Security Development Lifecycle
- **OWASP MASVS**: Mobile/ Desktop security
- **CIS Controls**: Critical Security Controls

### 9.2 Data Protection
- **GDPR**: Data minimization, user consent, right to deletion
- **CCPA**: Consumer privacy rights
- **Best Practice**: No data leaves device without explicit user action

---

## 10. Code Signing

### 10.1 Authenticode
- Release builds should be code-signed
- SHA-256 signature
- Timestamp server for signature validity
- EV certificate recommended

### 10.2 Build Verification
```cmd
signtool verify /pa /v SecureCrypt.exe
```

---

## 11. Security Checklist

### Pre-Release
- [ ] All cryptographic implementations reviewed
- [ ] Penetration testing completed
- [ ] Dependencies audited for vulnerabilities
- [ ] Anti-debug checks functional
- [ ] Secure memory operations verified
- [ ] Code signing applied
- [ ] Manifest security settings verified
- [ ] Compiler security flags enabled
- [ ] Installer permissions correct

### Ongoing
- [ ] Dependency updates monitored
- [ ] Security patches applied promptly
- [ ] User reports investigated
- [ ] New threat models evaluated
- [ ] Code reviews include security focus
- [ ] Static analysis (PVS-Studio, Cppcheck) run

---

## 12. Incident Response

### 12.1 Suspected Compromise
1. Lock app immediately
2. Change master password
3. Review logs in `%LOCALAPPDATA%\SecureCrypt\logs\`
4. Export backup (if needed)
5. Clear all data
6. Re-setup with new password

### 12.2 Lost Device
- Keys are DPAPI-protected and user-bound
- Data inaccessible without Windows login + master password
- Recommend remote wipe via Microsoft Intune

---

## 13. Secure Coding Guidelines

### 13.1 Rules
1. **Never** store passwords as `std::string`
2. **Always** use `SecureZeroMemory` for sensitive data
3. **Always** validate all inputs
4. **Never** log sensitive data
5. **Always** use RAII for resource management
6. **Never** use `strcpy`, `sprintf`, etc.
7. **Always** check return values
8. **Never** ignore security warnings

### 13.2 Forbidden Functions
```cpp
// DO NOT USE:
strcpy, strcat, sprintf, gets
memcpy (use secure version)
malloc (use RAII containers)
printf (use Logger)

// USE INSTEAD:
StringCchCopy, StringCchCat, StringCchPrintf
SecureZeroMemory + memcpy
std::vector, std::unique_ptr
Logger::Info, Logger::Error
```

---

*Last Updated: May 2026*
*Version: 1.0.0*
*Document Classification: Public*
