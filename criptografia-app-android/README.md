# SecureCrypt Android

**Professional Password & Document Vault for Android**

[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B-green.svg)](https://developer.android.com/)
[![Kotlin](https://img.shields.io/badge/Kotlin-1.9.22-purple.svg)](https://kotlinlang.org/)
[![Min SDK](https://img.shields.io/badge/Min%20SDK-26-blue.svg)](https://developer.android.com/guide/topics/manifest/uses-sdk-element)
[![Target SDK](https://img.shields.io/badge/Target%20SDK-34-blue.svg)](https://developer.android.com/guide/topics/manifest/uses-sdk-element)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

### Password Manager
- Store and manage passwords securely
- AES-256-GCM encryption per entry
- Strong password generator (24+ characters)
- Password strength validation
- Auto-fill support
- Favorites and categories
- Search functionality

### Secure Document Vault
- Encrypt and store sensitive documents
- Support for PDF, images, Office files
- Stream-based encryption for large files
- Secure export with integrity verification
- File metadata tracking

### Secure Notes
- Encrypted note storage
- Rich text support
- Tag-based organization
- Favorites system

### Security Features
- **Android Keystore** - Hardware-backed key storage
- **Biometric Authentication** - Fingerprint, Face, Iris
- **SQLCipher Database** - Encrypted local storage
- **Auto-Lock** - Configurable timeout
- **Brute Force Protection** - Rate limiting with lockout
- **Screen Protection** - No screenshots or screen recording
- **Secure Memory** - Zeroing sensitive buffers
- **No Cloud Backup** - Data never leaves device

---

## Architecture

```
app/src/main/java/com/securecrypt/android/
├── core/
│   ├── security/
│   │   ├── AndroidKeyStoreManager.kt    # Hardware-backed key management
│   │   ├── EncryptionService.kt         # AES-256-GCM encryption operations
│   │   ├── BiometricAuthManager.kt      # Biometric authentication
│   │   └── SecureStorageManager.kt      # Encrypted preferences
│   ├── database/
│   │   ├── SecureCryptDatabase.kt       # SQLCipher Room database
│   │   ├── PasswordDao.kt               # Password data access
│   │   ├── DocumentDao.kt               # Document data access
│   │   ├── NoteDao.kt                   # Note data access
│   │   └── Converters.kt                # Room type converters
│   └── utils/
│       └── ...                          # Utility functions
├── data/
│   ├── model/
│   │   └── Entities.kt                  # Room entities
│   └── repository/
│       ├── PasswordRepository.kt        # Password operations
│       ├── DocumentRepository.kt        # Document operations
│       └── NoteRepository.kt            # Note operations
├── domain/
│   └── usecase/                         # Business logic use cases
├── presentation/
│   ├── MainActivity.kt                  # Main activity
│   ├── ui/
│   │   ├── SecureCryptApp.kt            # App navigation
│   │   ├── theme/
│   │   │   └── Theme.kt                 # Material 3 theme
│   │   ├── screens/
│   │   │   ├── PasswordsScreen.kt       # Password list screen
│   │   │   ├── DocumentsScreen.kt       # Document list screen
│   │   │   └── SettingsScreen.kt        # Settings screen
│   │   └── components/                  # Reusable UI components
│   └── viewmodel/
│       ├── AuthViewModel.kt             # Authentication state
│       └── PasswordViewModel.kt         # Password management state
└── di/
    └── AppModule.kt                     # Hilt dependency injection
```

### Design Patterns
- **MVVM** (Model-View-ViewModel)
- **Repository Pattern** for data abstraction
- **Dependency Injection** with Hilt
- **Clean Architecture** principles
- **Jetpack Compose** for declarative UI

---

## Cryptographic Standards

| Component | Implementation |
|-----------|---------------|
| Cipher | AES-256-GCM |
| Key Derivation | PBKDF2-HMAC-SHA256 (10,000 iterations) |
| Key Storage | Android Keystore (Hardware-backed) |
| Database | SQLCipher (AES-256-CBC) |
| Preferences | EncryptedSharedPreferences (AES-256-GCM) |
| IV | 16 random bytes per operation |
| Salt | 16 random bytes per derivation |
| Auth Tag | 128 bits (GCM native) |

---

## Requirements

- **Android**: 8.0 (API 26) or higher
- **Kotlin**: 1.9.22
- **Gradle**: 8.2
- **Android Studio**: Hedgehog or later
- **JDK**: 17

---

## Setup

### 1. Clone the Repository

```bash
cd criptografia-app-android
```

### 2. Open in Android Studio

```bash
# Open Android Studio
# File > Open > Select criptografia-app-android folder
```

### 3. Sync Gradle

Android Studio will automatically sync the project. Wait for dependencies to download.

### 4. Build and Run

```bash
# Build debug APK
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug

# Run tests
./gradlew test

# Run instrumented tests
./gradlew connectedAndroidTest
```

---

## Build Variants

| Variant | Description |
|---------|------------|
| `debug` | Development build with debugging enabled |
| `release` | Production build with minification and obfuscation |

### Generate Release APK

```bash
./gradlew assembleRelease
```

The APK will be in `app/build/outputs/apk/release/`

### Generate App Bundle

```bash
./gradlew bundleRelease
```

The AAB will be in `app/build/outputs/bundle/release/`

---

## Security Configuration

### Keystore Setup (Release)

1. Generate a signing key:

```bash
keytool -genkeypair -v -keystore securecrypt-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias securecrypt
```

2. Add to `app/build.gradle.kts`:

```kotlin
signingConfigs {
    create("release") {
        storeFile = file("path/to/securecrypt-release.jks")
        storePassword = "your-store-password"
        keyAlias = "securecrypt"
        keyPassword = "your-key-password"
    }
}
```

3. Never commit the keystore file or passwords to version control.

---

## Testing

### Unit Tests

```bash
./gradlew test
```

### Instrumented Tests

```bash
./gradlew connectedAndroidTest
```

### Lint

```bash
./gradlew lint
```

---

## Dependencies

### Core
- AndroidX Core KTX: 1.12.0
- Lifecycle Runtime KTX: 2.7.0
- Activity Compose: 1.8.2

### Compose
- Compose BOM: 2024.02.00
- Material 3
- Navigation Compose: 2.7.7

### Dependency Injection
- Hilt: 2.50

### Database
- Room: 2.6.1
- SQLCipher: 4.5.4

### Security
- Security Crypto: 1.1.0-alpha06
- Biometric: 1.2.0-alpha05

### Other
- Kotlinx Coroutines: 1.7.3
- Kotlinx Serialization: 1.6.2
- Coil: 2.5.0

---

## Screenshots

| Passwords | Documents | Settings |
|-----------|-----------|----------|
| [Screenshot] | [Screenshot] | [Screenshot] |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow Kotlin coding conventions
- Use `ktlint` for formatting
- Write tests for new features
- Update documentation

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Android Keystore System](https://developer.android.com/training/articles/keystore)
- [SQLCipher](https://www.zetetic.net/sqlcipher/)
- [Jetpack Compose](https://developer.android.com/jetpack/compose)
- [Hilt](https://dagger.dev/hilt/)
- [Room](https://developer.android.com/training/data-storage/room)

---

## Contact

For security issues, please email: security@securecrypt.com

For general inquiries: support@securecrypt.com

---

*Built with security in mind.*
