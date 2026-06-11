#include "StorageManager.h"
#include "../utils/PathUtils.h"
#include "../utils/Logger.h"

namespace securecrypt::storage {

StorageManager& StorageManager::GetInstance() {
    static StorageManager instance;
    return instance;
}

StorageManager::StorageManager() {
}

StorageManager::~StorageManager() {
}

bool StorageManager::Initialize(const std::wstring& appDataPath) {
    m_appDataPath = appDataPath;
    m_dbPath = appDataPath + L"securecrypt.db";
    m_encryptedFilesPath = appDataPath + L"encrypted";
    m_logsPath = appDataPath + L"logs";
    m_tempPath = appDataPath + L"temp";
    m_backupsPath = appDataPath + L"backups";
    
    return CreateSecureDirectories();
}

std::wstring StorageManager::GetDatabasePath() const {
    return m_dbPath;
}

std::wstring StorageManager::GetEncryptedFilesPath() const {
    return m_encryptedFilesPath;
}

std::wstring StorageManager::GetLogsPath() const {
    return m_logsPath;
}

std::wstring StorageManager::GetTempPath() const {
    return m_tempPath;
}

std::wstring StorageManager::GetBackupsPath() const {
    return m_backupsPath;
}

bool StorageManager::CreateSecureDirectories() {
    using namespace securecrypt::utils;
    
    const wchar_t* dirs[] = {
        m_appDataPath.c_str(),
        m_encryptedFilesPath.c_str(),
        m_logsPath.c_str(),
        m_tempPath.c_str(),
        m_backupsPath.c_str()
    };
    
    for (const auto& dir : dirs) {
        if (!PathUtils::DirectoryExists(dir)) {
            if (!PathUtils::CreateDirectories(dir)) {
                Logger::GetInstance().Error(L"Failed to create directory: " + std::wstring(dir), L"StorageManager");
                return false;
            }
        }
    }
    
    return true;
}

bool StorageManager::CleanupTempFiles() {
    using namespace securecrypt::utils;
    
    auto files = PathUtils::ListFiles(m_tempPath);
    for (const auto& file : files) {
        if (!PathUtils::SecureDeleteFile(file)) {
            Logger::GetInstance().Warning(L"Failed to delete temp file: " + file, L"StorageManager");
        }
    }
    
    return true;
}

ULONGLONG StorageManager::GetStorageUsed() const {
    using namespace securecrypt::utils;
    
    ULONGLONG total = 0;
    
    auto files = PathUtils::ListFiles(m_encryptedFilesPath);
    for (const auto& file : files) {
        total += PathUtils::GetFileSize(file);
    }
    
    if (PathUtils::FileExists(m_dbPath)) {
        total += PathUtils::GetFileSize(m_dbPath);
    }
    
    return total;
}

std::wstring StorageManager::GetAppDataPath() const {
    return m_appDataPath;
}

}
