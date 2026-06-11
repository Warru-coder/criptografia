#pragma once

#include <windows.h>
#include <string>
#include <vector>

namespace securecrypt::storage {

class StorageManager {
public:
    static StorageManager& GetInstance();
    
    bool Initialize(const std::wstring& appDataPath);
    
    std::wstring GetDatabasePath() const;
    
    std::wstring GetEncryptedFilesPath() const;
    
    std::wstring GetLogsPath() const;
    
    std::wstring GetTempPath() const;
    
    std::wstring GetBackupsPath() const;
    
    bool CreateSecureDirectories();
    
    bool CleanupTempFiles();
    
    ULONGLONG GetStorageUsed() const;
    
    std::wstring GetAppDataPath() const;

private:
    StorageManager();
    ~StorageManager();
    
    std::wstring m_appDataPath;
    std::wstring m_dbPath;
    std::wstring m_encryptedFilesPath;
    std::wstring m_logsPath;
    std::wstring m_tempPath;
    std::wstring m_backupsPath;
};

}
