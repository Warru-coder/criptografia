# SecureCrypt Android - Security Policies

## Overview

This document outlines the comprehensive security policies implemented in SecureCrypt Android. These policies follow industry best practices and exceed standard security requirements for mobile applications handling sensitive data.

---

## 1. Cryptographic Standards

### 1.1 Encryption Algorithm
- **Cipher**: AES-256-GCM (Authenticated Encryption)
- **Key Size**: 256 bits
- **Mode**: GCM (Galois/Counter Mode)
- **Authentication Tag**: 128 bits
- **IV Size**: 16 bytes (128 bits), randomly generated per operation

### 1.2 Key Derivation
- **Algorithm**: PBKDF2-HMAC-SHA256 (platform `SecretKeyFactory`, OWASP-compliant)
- **Iterations**: 600,000
- **Salt**: 16 random bytes per derivation
- **Output Key Length**: 256 bits

### 1.3 Key Storage
- **Android Keystore System**: All cryptographic keys stored in hardware-backed secure element
- **Key Properties**:
  - User authentication required (biometric/PIN)
  - Unlocked device required
  - StrongBox backing when available (Android 9+)
  - Non-exportable keys
  - Automatic key invalidation on security state changes

### 1.4 File Encryption Format
```
[6 bytes: Magic "SCRYPT"]
[1 byte: Version]
[16 bytes: Salt]
[16 bytes: IV]
[Variable: Encrypted data + GCM auth tag]
```

---

## 2. Authentication Policies

### 2.1 Master Password Requirements
- **Minimum Length**: 12 characters
- **Recommended Length**: 16+ characters
- **Complexity Requirements**:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **Prohibited Patterns**:
  - Common passwords (password, 123456, qwerty, etc.)
  - Repeated characters (aaaa, 1111)
  - Sequential patterns (abcd, 1234)

### 2.2 Biometric Authentication
- **Required Security Level**: BIOMETRIC_STRONG
- **Supported Types**: Fingerprint, Face, Iris
- **Confirmation Required**: Yes (prevents accidental authentication)
- **Fallback**: Master password always available
- **Invalidation**: Biometric auth invalidated when:
  - New biometrics enrolled
  - All biometrics removed
  - Device lock screen disabled

### 2.3 Brute Force Protection
- **Maximum Failed Attempts**: 5
- **Lockout Duration**: 30 seconds (exponential backoff recommended)
- **Lockout Behavior**: Complete authentication block
- **Reset**: Successful authentication resets counter

### 2.4 Session Management
- **Auto-Lock Options**: Immediate, 30s, 1m, 5m, 15m, Never
- **Default Timeout**: 5 minutes
- **Lock Triggers**:
  - App backgrounded
  - Screen turned off
  - Timeout elapsed
  - Manual lock

---

## 3. Data Protection

### 3.1 Database Security
- **Engine**: SQLCipher (SQLite with 256-bit AES encryption)
- **Encryption Mode**: CBC-HMAC-SHA512
- **KDF Iterations**: 256,000
- **Secure Delete**: Enabled (PRAGMA secure_delete=ON)
- **Journal Mode**: WAL (Write-Ahead Logging)

### 3.2 Secure Preferences
- **Implementation**: EncryptedSharedPreferences
- **Key Encryption**: AES256-SIV
- **Value Encryption**: AES256-GCM
- **Master Key**: Android Keystore backed

### 3.3 File Storage
- **Location**: App internal storage (sandboxed)
- **Encryption**: AES-256-GCM per file
- **Integrity**: HMAC-SHA256 verification
- **Original Files**: Securely deleted after encryption

### 3.4 Memory Security
- **Sensitive Data Handling**:
  - Passwords stored in CharArray (not String)
  - Secure zeroing after use
  - Minimal time in memory
- **Buffers Cleared**:
  - Master password
  - Derived keys
  - Decrypted content
  - HMAC keys

---

## 4. Application Security

### 4.1 Screen Security
- **FLAG_SECURE**: Prevents screenshots and screen recording
- **Recent Apps**: Content hidden in task switcher
- **Orientation**: Portrait only (prevents screenshot rotation tricks)

### 4.2 Backup Prevention
- **Auto Backup**: Disabled
- **Cloud Backup**: Excluded
- **Device Transfer**: Excluded
- **Key-Value Backup**: Excluded

### 4.3 Network Security
- **Cleartext Traffic**: Blocked
- **Certificate Pinning**: Recommended for any API calls
- **TLS**: Required for all connections

### 4.4 Code Protection
- **Minification**: Enabled for release builds
- **Resource Shrinking**: Enabled
- **ProGuard Rules**: Custom rules for cryptographic classes
- **Debug Disabled**: Release builds not debuggable

---

## 5. Password Manager Security

### 5.1 Password Storage
- **Encryption**: Per-entry AES-256-GCM
- **Unique IV**: Each field encrypted with unique IV
- **Fields Encrypted**:
  - Username
  - Password
  - URL
  - Notes

### 5.2 Password Generator
- **Default Length**: 24 characters
- **Character Sets**:
  - Uppercase (A-Z)
  - Lowercase (a-z)
  - Numbers (0-9)
  - Symbols (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **Entropy**: ~156 bits (24 chars, 94 char set)

### 5.3 Clipboard Security
- **Auto-Clear**: 30 seconds
- **Warning**: User notified of clipboard risk
- **Recommendation**: Use auto-fill instead of copy/paste

---

## 6. Document Security

### 6.1 Import Process
1. User selects document
2. Document read into memory
3. AES-256-GCM encryption applied
4. Encrypted file written to secure storage
5. Original file securely deleted
6. Metadata stored in encrypted database

### 6.2 Export Process
1. User requests export
2. Document decrypted to temporary file
3. User selects export location
4. Temporary file securely deleted after export
5. Access logged

### 6.3 Supported Formats
- PDF documents
- Images (JPG, PNG, GIF)
- Text files
- Office documents (DOC, DOCX, XLS, XLSX)
- Archives (ZIP, RAR)

---

## 7. Threat Model

### 7.1 Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| Device theft | Android Keystore + Biometric + Master Password |
| Root access | Hardware-backed keys + SQLCipher |
| Memory scraping | Secure zeroing + CharArray usage |
| Screen capture | FLAG_SECURE |
| Backup extraction | Backup disabled |
| Brute force | Rate limiting + lockout |
| Tampered files | HMAC verification + GCM auth tags |
| Clipboard leaks | Auto-clear + warnings |
| Debug attacks | Debug disabled in release |

### 7.2 Residual Risks

| Risk | Notes |
|------|-------|
| Physical access with coercion | User may be forced to unlock |
| Advanced forensic analysis | Nation-state level attacks |
| Supply chain compromise | Build system integrity |
| Zero-day vulnerabilities | OS/keystore exploits |

---

## 8. Compliance

### 8.1 Standards Alignment
- **NIST SP 800-132**: PBKDF2 recommendations
- **NIST SP 800-38D**: GCM mode specification
- **OWASP MASVS**: Mobile Application Security Verification Standard
- **CIS Controls**: Critical Security Controls

### 8.2 Data Protection
- **GDPR**: Data minimization, user consent, right to deletion
- **CCPA**: Consumer privacy rights
- **Best Practice**: No data leaves device without explicit user action

---

## 9. Security Checklist

### Pre-Release
- [ ] All cryptographic implementations reviewed
- [ ] Penetration testing completed
- [ ] Dependencies audited for vulnerabilities
- [ ] ProGuard rules validated
- [ ] Debug features disabled
- [ ] Network security config verified
- [ ] Backup rules verified
- [ ] FLAG_SECURE active
- [ ] Keystore implementation tested

### Ongoing
- [ ] Dependency updates monitored
- [ ] Security patches applied promptly
- [ ] User reports investigated
- [ ] New threat models evaluated
- [ ] Code reviews include security focus

---

## 10. Incident Response

### 10.1 Suspected Compromise
1. Lock app immediately
2. Change master password
3. Review access logs
4. Export backup (if needed)
5. Clear all data
6. Re-setup with new password

### 10.2 Lost Device
- Keys are hardware-bound and non-exportable
- Data inaccessible without biometric + master password
- Remote wipe via Android Find My Device recommended

---

*Last Updated: May 2026*
*Version: 1.0.0*
*Document Classification: Public*
