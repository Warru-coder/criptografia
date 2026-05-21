## SecureCrypt Android - Development Guide

### Project Structure

```
criptografia-app-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/securecrypt/android/
│   │   │   │   ├── core/          # Core functionality
│   │   │   │   ├── data/          # Data layer
│   │   │   │   ├── domain/        # Business logic
│   │   │   │   ├── presentation/  # UI layer
│   │   │   │   └── di/            # Dependency injection
│   │   │   ├── res/               # Resources
│   │   │   └── AndroidManifest.xml
│   │   ├── test/                  # Unit tests
│   │   └── androidTest/           # Instrumented tests
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
│   └── wrapper/
├── build.gradle.kts
├── settings.gradle.kts
├── SECURITY.md
└── README.md
```

### Adding New Features

1. **Define the data model** in `data/model/`
2. **Create DAO** in `core/database/`
3. **Create Repository** in `data/repository/`
4. **Create UseCase** in `domain/usecase/`
5. **Create ViewModel** in `presentation/viewmodel/`
6. **Create Screen** in `presentation/ui/screens/`
7. **Update DI** in `di/AppModule.kt`

### Security Guidelines

1. **Never store passwords as strings** - Use CharArray
2. **Always zero sensitive buffers** - Use `secureClear()`
3. **Use Android Keystore** - Never store keys in code
4. **Encrypt all sensitive data** - At rest and in transit
5. **Validate all input** - Use strong validation
6. **Follow principle of least privilege** - Minimal permissions

### Code Style

- Use Kotlin conventions
- Follow MVVM pattern
- Use dependency injection
- Write tests for all new code
- Document complex cryptographic operations

### Testing

```bash
# Run all tests
./gradlew test

# Run specific test
./gradlew test --tests "com.securecrypt.android.*"

# Run with coverage
./gradlew testDebugUnitTestCoverage
```

### Release Checklist

- [ ] All tests passing
- [ ] Lint clean
- [ ] ProGuard rules tested
- [ ] Security review completed
- [ ] Dependencies updated
- [ ] Version bumped
- [ ] CHANGELOG updated
- [ ] Signed APK generated
