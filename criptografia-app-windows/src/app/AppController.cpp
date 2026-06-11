#include "AppController.h"
#include "../core/utils/PathUtils.h"
#include "../core/utils/Logger.h"
#include "../core/security/AntiDebug.h"
#include "../core/crypto/KeyManager.h"
#include "../core/storage/StorageManager.h"
#include "../ui/MainWindow.h"
#include "../ui/dialogs/AuthDialog.h"
#include <shellapi.h>

namespace securecrypt::app {

AppController& AppController::GetInstance() {
    static AppController instance;
    return instance;
}

AppController::AppController() : m_isInitialized(false), m_isAuthenticated(false), m_isFirstRun(true), m_version(L"1.0.0") {
}

AppController::~AppController() {
    Shutdown();
}

bool AppController::Initialize(HINSTANCE hInstance) {
    if (m_isInitialized) return true;
    
    using namespace securecrypt::utils;
    using namespace securecrypt::security;
    
    if (AntiDebug::IsBeingDebugged()) {
        MessageBoxW(NULL, L"Debugger detected. Application will not run in debug mode.",
                   L"Security Alert", MB_ICONERROR | MB_OK);
        return false;
    }
    
    AntiDebug::EnableAntiDebug();
    
    Logger::GetInstance().Initialize(PathUtils::GetAppDataPath() + L"logs\\securecrypt.log");
    Logger::GetInstance().Info(L"Application starting", L"AppController");
    
    if (!SetupDirectories()) {
        Logger::GetInstance().Error(L"Failed to setup directories", L"AppController");
        return false;
    }
    
    if (!StorageManager::GetInstance().Initialize(PathUtils::GetAppDataPath())) {
        Logger::GetInstance().Error(L"Failed to initialize storage", L"AppController");
        return false;
    }
    
    m_isFirstRun = !PathUtils::FileExists(PathUtils::GetAppDataPath() + L"keys\\hash.dat");
    
    RegisterSingleInstance();
    
    m_isInitialized = true;
    Logger::GetInstance().Info(L"Application initialized successfully", L"AppController");
    
    return true;
}

int AppController::Run(HINSTANCE hInstance, int nCmdShow) {
    if (!m_isInitialized) {
        if (!Initialize(hInstance)) {
            return -1;
        }
    }
    
    ui::MainWindow mainWindow;

    if (!mainWindow.Create(hInstance, nCmdShow)) {
        Logger::GetInstance().Error(L"Failed to create main window", L"AppController");
        return -1;
    }

    INT_PTR authResult = ui::dialogs::AuthDialog::Show(mainWindow.GetHandle(), m_isFirstRun);
    if (authResult == IDCANCEL) {
        DestroyWindow(mainWindow.GetHandle());
        return 0;
    }

    m_isAuthenticated = true;
    mainWindow.LoadData();
    return mainWindow.Run();
}

void AppController::Shutdown() {
    Logger::GetInstance().Info(L"Application shutting down", L"AppController");
    
    crypto::KeyManager::GetInstance().ClearKeys();
    
    Logger::GetInstance().Flush();
}

bool AppController::IsFirstRun() {
    return m_isFirstRun;
}

bool AppController::IsAuthenticated() {
    return m_isAuthenticated;
}

void AppController::Lock() {
    crypto::KeyManager::GetInstance().Lock();
    m_isAuthenticated = false;
    Logger::GetInstance().Info(L"Application locked", L"AppController");
}

void AppController::Unlock() {
    m_isAuthenticated = true;
    Logger::GetInstance().Info(L"Application unlocked", L"AppController");
}

std::wstring AppController::GetVersion() const {
    return m_version;
}

bool AppController::SetupDirectories() {
    using namespace securecrypt::utils;
    
    std::wstring appData = PathUtils::GetAppDataPath();
    
    PathUtils::CreateDirectories(appData);
    PathUtils::CreateDirectories(appData + L"keys");
    PathUtils::CreateDirectories(appData + L"encrypted");
    PathUtils::CreateDirectories(appData + L"logs");
    PathUtils::CreateDirectories(appData + L"temp");
    PathUtils::CreateDirectories(appData + L"backups");
    
    return true;
}

bool AppController::CheckForUpdates() {
    return false;
}

void AppController::RegisterSingleInstance() {
    CreateMutexW(NULL, TRUE, L"SecureCrypt_SingleInstance_Mutex");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND hWnd = FindWindowW(L"SecureCryptMainWindow", NULL);
        if (hWnd) {
            SetForegroundWindow(hWnd);
            ShowWindow(hWnd, SW_RESTORE);
        }
        ExitProcess(0);
    }
}

}
