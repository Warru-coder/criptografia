#include "SecureDatabase.h"
#include "../utils/Logger.h"
#include <sqlite3.h>

namespace securecrypt::storage {

SecureDatabase& SecureDatabase::GetInstance() {
    static SecureDatabase instance;
    return instance;
}

SecureDatabase::SecureDatabase() : m_db(nullptr), m_isInitialized(false) {
}

SecureDatabase::~SecureDatabase() {
    Close();
}

bool SecureDatabase::Initialize(const std::wstring& dbPath, const std::vector<BYTE>& key) {
    if (m_isInitialized) return true;
    
    std::string pathUtf8;
    pathUtf8.resize(dbPath.size());
    pathUtf8.resize(WideCharToMultiByte(CP_UTF8, 0, dbPath.c_str(), -1, &pathUtf8[0], static_cast<int>(dbPath.size()), NULL, NULL));
    
    int rc = sqlite3_open(pathUtf8.c_str(), &m_db);
    if (rc != SQLITE_OK) {
        Logger::GetInstance().Error(L"Failed to open database", L"SecureDatabase");
        return false;
    }
    
    std::string keyStr(reinterpret_cast<const char*>(key.data()), key.size());
    sqlite3_key(m_db, keyStr.c_str(), static_cast<int>(key.size()));
    
    if (!CreateTables()) {
        Logger::GetInstance().Error(L"Failed to create tables", L"SecureDatabase");
        return false;
    }
    
    Execute("PRAGMA journal_mode=WAL;");
    Execute("PRAGMA secure_delete=ON;");
    Execute("PRAGMA foreign_keys=ON;");
    
    m_isInitialized = true;
    Logger::GetInstance().Info(L"Database initialized", L"SecureDatabase");
    return true;
}

bool SecureDatabase::IsInitialized() const {
    return m_isInitialized;
}

bool SecureDatabase::Execute(const std::string& sql) {
    if (!m_db || !m_isInitialized) return false;
    
    char* errMsg = nullptr;
    int rc = sqlite3_exec(m_db, sql.c_str(), nullptr, nullptr, &errMsg);
    
    if (rc != SQLITE_OK) {
        Logger::GetInstance().Error(L"SQL error: " + std::wstring(errMsg, errMsg + strlen(errMsg)), L"SecureDatabase");
        sqlite3_free(errMsg);
        return false;
    }
    
    return true;
}

bool SecureDatabase::Execute(const std::wstring& sql) {
    std::string utf8;
    utf8.resize(sql.size());
    utf8.resize(WideCharToMultiByte(CP_UTF8, 0, sql.c_str(), -1, &utf8[0], static_cast<int>(sql.size()), NULL, NULL));
    return Execute(utf8);
}

std::vector<std::vector<std::string>> SecureDatabase::Query(const std::string& sql) {
    std::vector<std::vector<std::string>> results;
    
    if (!m_db || !m_isInitialized) return results;
    
    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(m_db, sql.c_str(), -1, &stmt, nullptr);
    
    if (rc != SQLITE_OK) return results;
    
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        std::vector<std::string> row;
        int cols = sqlite3_column_count(stmt);
        
        for (int i = 0; i < cols; ++i) {
            const unsigned char* text = sqlite3_column_text(stmt, i);
            row.push_back(text ? reinterpret_cast<const char*>(text) : "");
        }
        
        results.push_back(row);
    }
    
    sqlite3_finalize(stmt);
    return results;
}

bool SecureDatabase::BeginTransaction() {
    return Execute("BEGIN TRANSACTION;");
}

bool SecureDatabase::CommitTransaction() {
    return Execute("COMMIT;");
}

bool SecureDatabase::RollbackTransaction() {
    return Execute("ROLLBACK;");
}

sqlite3* SecureDatabase::GetHandle() {
    return m_db;
}

void SecureDatabase::Close() {
    if (m_db) {
        sqlite3_close(m_db);
        m_db = nullptr;
        m_isInitialized = false;
    }
}

bool SecureDatabase::CreateTables() {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS passwords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            encrypted_username BLOB NOT NULL,
            encrypted_password BLOB NOT NULL,
            encrypted_url BLOB DEFAULT X'',
            encrypted_notes BLOB DEFAULT X'',
            category TEXT DEFAULT '',
            iv BLOB NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            last_accessed INTEGER DEFAULT 0,
            access_count INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            tags TEXT DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            encrypted_file_path TEXT NOT NULL,
            mime_type TEXT DEFAULT '',
            file_size INTEGER DEFAULT 0,
            iv BLOB NOT NULL,
            hmac BLOB NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            last_accessed INTEGER DEFAULT 0,
            access_count INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            thumbnail_path TEXT DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            encrypted_content BLOB NOT NULL,
            iv BLOB NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            is_favorite INTEGER DEFAULT 0,
            tags TEXT DEFAULT ''
        );
        
        CREATE INDEX IF NOT EXISTS idx_passwords_title ON passwords(title);
        CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category);
        CREATE INDEX IF NOT EXISTS idx_passwords_favorite ON passwords(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
        CREATE INDEX IF NOT EXISTS idx_documents_favorite ON documents(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
        CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(is_favorite);
    )";
    
    return Execute(sql);
}

}
