#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <cstdint>

struct sqlite3;
struct sqlite3_stmt;

namespace securecrypt::storage {

class SecureDatabase {
public:
    static SecureDatabase& GetInstance();

    bool Initialize(const std::wstring& dbPath);

    bool IsInitialized() const;

    bool Execute(const std::string& sql);

    bool Execute(const std::wstring& sql);

    std::vector<std::vector<std::string>> Query(const std::string& sql);

    bool ExecutePrepared(const std::string& sql, std::function<void(sqlite3_stmt*)> binder);

    bool InsertPrepared(const std::string& sql, std::function<void(sqlite3_stmt*)> binder);

    std::vector<std::vector<std::string>> QueryPrepared(const std::string& sql, std::function<void(sqlite3_stmt*)> binder);

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
