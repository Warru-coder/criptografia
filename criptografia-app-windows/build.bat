@echo off
REM SecureCrypt Windows Build Script
REM Requires: Visual Studio 2022, CMake 3.20+, Windows SDK

echo ========================================
echo   SecureCrypt Build Script
echo ========================================
echo.

REM Check for Visual Studio
if not defined VSINSTALLDIR (
    echo Setting up Visual Studio environment...
    call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Visual Studio not found. Please install VS 2022.
        exit /b 1
    )
)

REM Create build directory
if not exist build mkdir build
cd build

REM Configure
echo.
echo Configuring CMake...
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Release
if %ERRORLEVEL% neq 0 (
    echo ERROR: CMake configuration failed.
    exit /b 1
)

REM Build
echo.
echo Building SecureCrypt...
cmake --build . --config Release --parallel
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed.
    exit /b 1
)

REM Run tests
echo.
echo Running tests...
ctest -C Release --output-on-failure
if %ERRORLEVEL% neq 0 (
    echo WARNING: Some tests failed.
)

echo.
echo ========================================
echo   Build completed successfully!
echo ========================================
echo.
echo Output: build\bin\Release\SecureCrypt.exe
echo.

cd ..
