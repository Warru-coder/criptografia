# Quick Start Guide - SecureCrypt Windows

## Prerequisites

1. **Visual Studio 2022** (Community edition is free)
   - Install with "Desktop development with C++" workload
   
2. **CMake 3.20+**
   - Download from https://cmake.org/download/
   - Or use Visual Studio's built-in CMake

3. **Windows SDK**
   - Included with Visual Studio 2022

## Build Steps

### Option 1: Using Build Script (Recommended)

```cmd
cd criptografia-app-windows
build.bat
```

### Option 2: Manual CMake

```cmd
cd criptografia-app-windows
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

### Option 3: Visual Studio IDE

1. Open Visual Studio 2022
2. File > Open > CMake
3. Select `CMakeLists.txt`
4. Select "x64-Release" configuration
5. Build > Build All

## Run

```cmd
build\bin\Release\SecureCrypt.exe
```

## Build Installer

```cmd
# Install Inno Setup 6 first: https://jrsoftware.org/isdl.php
build-installer.bat
```

Output: `installer\output\SecureCrypt-Setup-1.0.0.exe`

## Project Structure

```
criptografia-app-windows/
├── CMakeLists.txt          # Main build configuration
├── build.bat               # Quick build script
├── build-installer.bat     # Installer build script
├── README.md               # Project documentation
├── SECURITY.md             # Security policies
├── src/
│   ├── app/                # Application entry point
│   ├── core/               # Core functionality
│   │   ├── crypto/         # AES-256-GCM, key management
│   │   ├── security/       # Anti-debug, secure memory
│   │   ├── storage/        # Database, file management
│   │   └── utils/          # Logging, string/path utilities
│   ├── data/               # Data layer
│   │   ├── model/          # Data structures
│   │   └── repository/     # Data access
│   └── ui/                 # User interface
│       ├── dialogs/        # Dialog windows
│       └── controls/       # Custom controls
├── tests/                  # Unit and integration tests
├── installer/              # Inno Setup installer script
├── resources/              # Icons, manifest, version info
└── third_party/            # SQLite3, dependencies
```

## Troubleshooting

### CMake not found
```cmd
# Add CMake to PATH or use full path
"C:\Program Files\CMake\bin\cmake.exe" --version
```

### Visual Studio not detected
```cmd
# Run vcvarsall.bat manually
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
```

### Build fails with missing headers
- Ensure Windows SDK is installed
- Check Visual Studio has "Windows 10/11 SDK" component

### Linker errors
- Ensure all Windows libraries are linked (bcrypt, crypt32, etc.)
- Check CMakeLists.txt for target_link_libraries

## Next Steps

1. Read `SECURITY.md` for security policies
2. Read `README.md` for full documentation
3. Run tests: `cd build && ctest`
4. Customize the UI in `src/ui/`
