# Plan de Creación del Ejecutable Windows — SecureCrypt

Documento generado: 2026-06-18

App C++20 Win32 nativa con CMake + SQLite estático e instalador Inno Setup.
Tal cual está el repo hoy, el build **no compila** ni el instalador empaqueta:
faltan artefactos y hay rutas incorrectas. Este documento lista los bloqueadores
y el plan paso a paso para producir `SecureCrypt.exe` y su instalador.

---

## Estado actual

| Pieza | Estado |
|---|---|
| `CMakeLists.txt` raíz | OK, multi-config VS2022, flags de seguridad correctos (`/guard:cf`, ASLR, DEP, LTCG) |
| `src/` (app, core, data, ui) | Presente |
| `third_party/sqlite/CMakeLists.txt` | OK pero **falta `sqlite3.c` y `sqlite3.h`** (amalgamation no descargada) |
| `third_party/imgui/` | **Vacía** (no se usa en CMakeLists, se puede ignorar/borrar) |
| `third_party/sqlcipher/` | Sin contenido confirmado (no referenciada en CMake → ignorable) |
| `resources/icons/` | **Vacía** → `SecureCrypt.rc` referencia `app.ico` que no existe |
| `resources/images/` | **Vacía** → instalador referencia `wizard-large.bmp` y `wizard-small.bmp` que no existen |
| `LICENSE` en raíz | **No existe** → `SecureCrypt.iss` lo requiere |
| `installer/SecureCrypt.iss` | **Ruta incorrecta**: usa `..\build\bin\SecureCrypt.exe` pero VS2022 multi-config lo deja en `..\build\bin\Release\SecureCrypt.exe` |
| Toolchain en PATH | `cmake` / `cl` / `iscc` no detectados en la shell actual |

---

## Plan de creación del ejecutable

### Fase 1 — Preparar prerequisitos (manual, una sola vez)

1. **Visual Studio 2022 Community** con workload *"Desktop development with C++"*
   (incluye MSVC v143, Windows 11 SDK, CMake integrado).
2. **Inno Setup 6** desde https://jrsoftware.org/isdl.php (sólo para el instalador).
3. Verificar desde *"x64 Native Tools Command Prompt for VS 2022"*:
   `cl`, `cmake`, `iscc` deben responder.

### Fase 2 — Completar artefactos faltantes

1. **SQLite amalgamation**: descargar `sqlite-amalgamation-XXXXXXX.zip` de
   https://sqlite.org/download.html y copiar `sqlite3.c` + `sqlite3.h` a
   `third_party/sqlite/`.
2. **Icono**: crear/colocar `resources/icons/app.ico` (multi-resolución 16/32/48/256).
3. **Imágenes del wizard Inno Setup** (BMP, no PNG):
   - `resources/images/wizard-large.bmp` (164×314)
   - `resources/images/wizard-small.bmp` (55×58)
   Alternativa: comentar esas líneas en el `.iss` y usar el wizard por defecto.
4. **LICENSE** en raíz del proyecto (texto MIT, ya declarado en README).
5. Decidir sobre `third_party/imgui` y `third_party/sqlcipher`: borrar las
   carpetas vacías o documentar que no se usan (CMake actual no las referencia).

### Fase 3 — Compilar el ejecutable

Desde *"x64 Native Tools Command Prompt for VS 2022"* en la carpeta del proyecto:

```cmd
build.bat
```

Equivalente manual:

```cmd
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release --parallel
ctest --test-dir build -C Release --output-on-failure
```

Salida esperada: `build\bin\Release\SecureCrypt.exe` (estático, sin DLLs
runtime gracias a `MultiThreaded` MSVC runtime + SQLite estático).

### Fase 4 — Validación post-build

1. Verificar mitigaciones activas:
   ```cmd
   dumpbin /headers build\bin\Release\SecureCrypt.exe | findstr /i "DLL characteristics"
   ```
   Debe aparecer: **Dynamic base**, **NX compatible**, **High Entropy VA**,
   **Control Flow Guard**.
2. Verificar dependencias:
   ```cmd
   dumpbin /dependents build\bin\Release\SecureCrypt.exe
   ```
   Sólo debería depender de DLLs de sistema (bcrypt, crypt32, etc.), nunca
   de `MSVCP*.dll` ni `VCRUNTIME*.dll`.
3. Ejecutar el binario standalone en una VM/usuario limpio para confirmar
   que no faltan runtimes.

### Fase 5 — Arreglar y compilar el instalador

1. **Editar `installer/SecureCrypt.iss`**:
   - `Source: "..\build\bin\SecureCrypt.exe"` → `Source: "..\build\bin\Release\SecureCrypt.exe"`.
   - Eliminar línea `Source: "..\build\bin\*.dll"` (no hay DLLs; con `*`
     rompería si no existen — alternativamente añadir `skipifsourcedoesntexist`).
   - Revisar requisito de `.NET Framework 4.0` en `InitializeSetup()`: la app
     es C++ nativa pura, **este chequeo sobra** → eliminarlo o dejarlo (4.0
     viene con Win10+).
2. Compilar instalador:
   ```cmd
   build-installer.bat
   ```
   Salida: `installer\output\SecureCrypt-Setup-1.0.0.exe`.

### Fase 6 (opcional, recomendada) — Firma Authenticode

1. Obtener certificado EV/OV (o autofirmado para pruebas):
   ```powershell
   New-SelfSignedCertificate -Subject "CN=SecureCrypt Dev" -Type CodeSigningCert -CertStoreLocation Cert:\CurrentUser\My
   ```
2. Firmar binario e instalador:
   ```cmd
   signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a build\bin\Release\SecureCrypt.exe
   signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a installer\output\SecureCrypt-Setup-1.0.0.exe
   ```

Sin firma, SmartScreen mostrará advertencia de editor desconocido en
instalaciones nuevas.

### Fase 7 — Distribución

Entregar `SecureCrypt-Setup-1.0.0.exe` (instalador) **o** el `SecureCrypt.exe`
portable (no necesita runtime gracias a `/MT`). Recomendado: distribuir ambos
y publicar SHA-256 de cada uno.

---

## Checklist resumido

- [ ] VS 2022 + workload C++ instalado
- [ ] Inno Setup 6 instalado
- [ ] `third_party/sqlite/sqlite3.c` y `sqlite3.h` copiados
- [ ] `resources/icons/app.ico` creado
- [ ] `resources/images/wizard-large.bmp` y `wizard-small.bmp` creados (o `.iss` ajustado)
- [ ] `LICENSE` en raíz
- [ ] `build.bat` compila sin warnings (recordar `/WX` = warnings as errors)
- [ ] `ctest` pasa
- [ ] `dumpbin` muestra mitigaciones activas y sin dependencias VC runtime
- [ ] `.iss` corregido (ruta Release, sin chequeo .NET, sin glob de DLLs)
- [ ] `build-installer.bat` produce `SecureCrypt-Setup-1.0.0.exe`
- [ ] (Opcional) Binario e instalador firmados con `signtool`
- [ ] SHA-256 publicado junto al artefacto
