@echo off
REM SecureCrypt Installer Build Script
REM Requires: Inno Setup 6.x

echo ========================================
echo   Building SecureCrypt Installer
echo ========================================
echo.

REM Check for Inno Setup
set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% (
    set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
)

if not exist %ISCC% (
    echo ERROR: Inno Setup 6 not found.
    echo Please install from: https://jrsoftware.org/isdl.php
    exit /b 1
)

REM Build installer
echo Compiling installer...
%ISCC% installer\SecureCrypt.iss
if %ERRORLEVEL% neq 0 (
    echo ERROR: Installer build failed.
    exit /b 1
)

echo.
echo ========================================
echo   Installer built successfully!
echo ========================================
echo.
echo Output: installer\output\SecureCrypt-Setup-1.0.0.exe
echo.
