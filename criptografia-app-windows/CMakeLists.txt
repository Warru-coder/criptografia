cmake_minimum_required(VERSION 3.20)
project(SecureCrypt VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

if(MSVC)
    add_compile_options(
        /W4
        /WX
        /permissive-
        /utf-8
        /sdl
        /guard:cf
        /DYNAMICBASE
        /HIGHENTROPYVA
        /NXCOMPAT
    )
    
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        add_compile_options(
            /O2
            /GL
            /Gy
            /GS
        )
        add_link_options(
            /LTCG
            /OPT:REF
            /OPT:ICF
        )
    endif()
endif()

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

find_package(Threads REQUIRED)

set(THIRD_PARTY_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party)

add_subdirectory(${THIRD_PARTY_DIR}/sqlite sqlite_build)

set(SOURCES
    src/app/main.cpp
    src/app/AppController.cpp
    src/app/AppController.h
    src/core/crypto/CryptoEngine.cpp
    src/core/crypto/CryptoEngine.h
    src/core/crypto/KeyManager.cpp
    src/core/crypto/KeyManager.h
    src/core/crypto/FileCipher.cpp
    src/core/crypto/FileCipher.h
    src/core/crypto/PasswordGenerator.cpp
    src/core/crypto/PasswordGenerator.h
    src/core/security/SecureMemory.cpp
    src/core/security/SecureMemory.h
    src/core/security/AntiDebug.cpp
    src/core/security/AntiDebug.h
    src/core/security/ClipboardManager.cpp
    src/core/security/ClipboardManager.h
    src/core/storage/SecureDatabase.cpp
    src/core/storage/SecureDatabase.h
    src/core/storage/StorageManager.cpp
    src/core/storage/StorageManager.h
    src/core/utils/Logger.cpp
    src/core/utils/Logger.h
    src/core/utils/StringUtils.cpp
    src/core/utils/StringUtils.h
    src/core/utils/PathUtils.cpp
    src/core/utils/PathUtils.h
    src/ui/MainWindow.cpp
    src/ui/MainWindow.h
    src/ui/ResourceLoader.cpp
    src/ui/ResourceLoader.h
    src/ui/dialogs/AuthDialog.cpp
    src/ui/dialogs/AuthDialog.h
    src/ui/dialogs/PasswordDialog.cpp
    src/ui/dialogs/PasswordDialog.h
    src/ui/dialogs/DocumentDialog.cpp
    src/ui/dialogs/DocumentDialog.h
    src/ui/dialogs/SettingsDialog.cpp
    src/ui/dialogs/SettingsDialog.h
    src/ui/controls/ModernButton.cpp
    src/ui/controls/ModernButton.h
    src/ui/controls/SecureInput.cpp
    src/ui/controls/SecureInput.h
    src/data/model/Models.cpp
    src/data/model/Models.h
    src/data/repository/PasswordRepository.cpp
    src/data/repository/PasswordRepository.h
    src/data/repository/DocumentRepository.cpp
    src/data/repository/DocumentRepository.h
    src/data/repository/NoteRepository.cpp
    src/data/repository/NoteRepository.h
)

set(HEADERS
    src/app/AppController.h
    src/core/crypto/CryptoEngine.h
    src/core/crypto/KeyManager.h
    src/core/crypto/FileCipher.h
    src/core/crypto/PasswordGenerator.h
    src/core/security/SecureMemory.h
    src/core/security/AntiDebug.h
    src/core/security/ClipboardManager.h
    src/core/storage/SecureDatabase.h
    src/core/storage/StorageManager.h
    src/core/utils/Logger.h
    src/core/utils/StringUtils.h
    src/core/utils/PathUtils.h
    src/ui/MainWindow.h
    src/ui/ResourceLoader.h
    src/ui/dialogs/AuthDialog.h
    src/ui/dialogs/PasswordDialog.h
    src/ui/dialogs/DocumentDialog.h
    src/ui/dialogs/SettingsDialog.h
    src/ui/controls/ModernButton.h
    src/ui/controls/SecureInput.h
    src/data/model/Models.h
    src/data/repository/PasswordRepository.h
    src/data/repository/DocumentRepository.h
    src/data/repository/NoteRepository.h
)

set(RESOURCES
    resources/SecureCrypt.rc
    resources/app.manifest
)

add_executable(${PROJECT_NAME} WIN32 ${SOURCES} ${HEADERS} ${RESOURCES})

target_link_libraries(${PROJECT_NAME} PRIVATE
    Threads::Threads
    bcrypt
    crypt32
    ncrypt
    advapi32
    user32
    gdi32
    comctl32
    shell32
    comdlg32
    ole32
    oleaut32
    uuid
    winhttp
    dwmapi
    uxtheme
    sqlite_lib
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/sqlite
)

target_compile_definitions(${PROJECT_NAME} PRIVATE
    UNICODE
    _UNICODE
    WIN32_LEAN_AND_MEAN
    NOMINMAX
    _CRT_SECURE_NO_WARNINGS
    $<$<CONFIG:Debug>:DEBUG_BUILD>
    $<$<CONFIG:Release>:NDEBUG>
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set_target_properties(${PROJECT_NAME} PROPERTIES
        WIN32_EXECUTABLE TRUE
        LINK_FLAGS "/SUBSYSTEM:WINDOWS"
    )
endif()

install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION bin
)

install(DIRECTORY resources/
    DESTINATION resources
    FILES_MATCHING PATTERN "*.png" PATTERN "*.ico" PATTERN "*.css"
)

enable_testing()
add_subdirectory(tests)
