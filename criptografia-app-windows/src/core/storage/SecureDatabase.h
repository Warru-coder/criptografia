#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include <memory>

struct sqlite3;

namespace securecrypt::storage {

class SecureDatabase {
public:
    static SecureDatabase& GetInstance();
    
    bool Initialize(const std::wstring& dbPath, const std::vector<BYTE>& key);
    
    bool IsInitialized() const;
    
    bool Execute(const std::string& sql);
    
    bool Execute(const std::wstring& sql);
    
    std::vector<std::vector<std::string>> Query(const std::string& sql);
    
    bool BeginTransaction();
    
    bool CommitTransaction();
    
    bool RollbackTransaction();
    
    sqlite3* GetHandle();
    
    void Close();

private:
    SecureDatabase();
    ~SecureDatabase();
    
    SecureDatabase(const SecureDatabase&) = delete;
    SecureDatabase& operator=(const SecureDatabase&) = delete;
    
    sqlite3* m_db;
    bool m_isInitialized;
    
    bool CreateTables();
};

}
