#include "PasswordRepository.h"
#include "../../core/crypto/KeyManager.h"
#include "../../core/crypto/CryptoEngine.h"
#include "../../core/storage/SecureDatabase.h"
#include "../../core/utils/Logger.h"
#include "../../core/utils/StringUtils.h"
#include <sqlite3.h>

namespace securecrypt::repository {

PasswordRepository& PasswordRepository::GetInstance() {
    static PasswordRepository instance;
    return instance;
}

PasswordRepository::PasswordRepository() {}
PasswordRepository::~PasswordRepository() {}

bool PasswordRepository::Initialize() {
    return true;
}

std::wstring PasswordRepository::DecryptFieldBase64(const std::string& b64) {
    if (b64.empty()) return L"";
    try {
        auto packed = utils::StringUtils::FromBase64(b64);
        if (packed.size() < 33) return L"";
        crypto::EncryptedData enc;
        enc.iv.assign(packed.begin(), packed.begin() + 16);
        enc.authTag.assign(packed.begin() + 16, packed.begin() + 32);
        enc.ciphertext.assign(packed.begin() + 32, packed.end());
        auto key = crypto::KeyManager::GetInstance().GetEncryptionKey();
        crypto::CryptoEngine engine;
        auto plain = engine.DecryptData(enc, key);
        std::string utf8(plain.begin(), plain.end());
        return utils::StringUtils::Utf8ToWide(utf8);
    } catch (...) { return L""; }
}

std::string PasswordRepository::EncryptFieldToBase64(const std::wstring& field) {
    auto utf8 = utils::StringUtils::WideToUtf8(field);
    std::vector<BYTE> plain(utf8.begin(), utf8.end());
    auto key = crypto::KeyManager::GetInstance().GetEncryptionKey();
    crypto::CryptoEngine engine;
    auto enc = engine.EncryptData(plain, key);
    std::vector<BYTE> packed;
    packed.insert(packed.end(), enc.iv.begin(), enc.iv.end());
    packed.insert(packed.end(), enc.authTag.begin(), enc.authTag.end());
    packed.insert(packed.end(), enc.ciphertext.begin(), enc.ciphertext.end());
    return utils::StringUtils::ToBase64(packed);
}

std::vector<data::DecryptedPassword> PasswordRepository::GetAllPasswords() {
    std::vector<data::DecryptedPassword> result;

    auto rows = storage::SecureDatabase::GetInstance().Query(
        "SELECT id, title, encrypted_username, encrypted_password, encrypted_url, "
        "encrypted_notes, category, is_favorite, tags FROM passwords ORDER BY title");

    for (auto& row : rows) {
        if (row.size() < 9) continue;
        data::DecryptedPassword p = {};
        try { p.id = std::stoi(row[0]); } catch (...) { continue; }
        p.title    = utils::StringUtils::Utf8ToWide(row[1]);
        p.username = DecryptFieldBase64(row[2]);
        p.password = DecryptFieldBase64(row[3]);
        p.url      = DecryptFieldBase64(row[4]);
        p.notes    = DecryptFieldBase64(row[5]);
        p.category = utils::StringUtils::Utf8ToWide(row[6]);
        try { p.isFavorite = std::stoi(row[7]) != 0; } catch (...) {}
        p.tags     = utils::StringUtils::Utf8ToWide(row[8]);
        result.push_back(std::move(p));
    }

    return result;
}

std::vector<data::DecryptedPassword> PasswordRepository::SearchPasswords(const std::wstring& query) {
    std::vector<data::DecryptedPassword> result;

    std::string likeArg = "%" + utils::StringUtils::WideToUtf8(query) + "%";

    auto rows = storage::SecureDatabase::GetInstance().QueryPrepared(
        "SELECT id, title, encrypted_username, encrypted_password, encrypted_url, "
        "encrypted_notes, category, is_favorite, tags FROM passwords WHERE title LIKE ? ORDER BY title",
        [&](sqlite3_stmt* stmt) {
            sqlite3_bind_text(stmt, 1, likeArg.c_str(), -1, SQLITE_TRANSIENT);
        });

    for (auto& row : rows) {
        if (row.size() < 9) continue;
        data::DecryptedPassword p = {};
        try { p.id = std::stoi(row[0]); } catch (...) { continue; }
        p.title    = utils::StringUtils::Utf8ToWide(row[1]);
        p.username = DecryptFieldBase64(row[2]);
        p.password = DecryptFieldBase64(row[3]);
        p.url      = DecryptFieldBase64(row[4]);
        p.notes    = DecryptFieldBase64(row[5]);
        p.category = utils::StringUtils::Utf8ToWide(row[6]);
        try { p.isFavorite = std::stoi(row[7]) != 0; } catch (...) {}
        p.tags     = utils::StringUtils::Utf8ToWide(row[8]);
        result.push_back(std::move(p));
    }

    return result;
}

std::vector<data::DecryptedPassword> PasswordRepository::GetFavoritePasswords() {
    std::vector<data::DecryptedPassword> result;

    auto rows = storage::SecureDatabase::GetInstance().QueryPrepared(
        "SELECT id, title, encrypted_username, encrypted_password, encrypted_url, "
        "encrypted_notes, category, is_favorite, tags FROM passwords WHERE is_favorite = 1 ORDER BY title",
        [](sqlite3_stmt*) {});

    for (auto& row : rows) {
        if (row.size() < 9) continue;
        data::DecryptedPassword p = {};
        try { p.id = std::stoi(row[0]); } catch (...) { continue; }
        p.title    = utils::StringUtils::Utf8ToWide(row[1]);
        p.username = DecryptFieldBase64(row[2]);
        p.password = DecryptFieldBase64(row[3]);
        p.url      = DecryptFieldBase64(row[4]);
        p.notes    = DecryptFieldBase64(row[5]);
        p.category = utils::StringUtils::Utf8ToWide(row[6]);
        try { p.isFavorite = std::stoi(row[7]) != 0; } catch (...) {}
        p.tags     = utils::StringUtils::Utf8ToWide(row[8]);
        result.push_back(std::move(p));
    }

    return result;
}

std::optional<data::DecryptedPassword> PasswordRepository::GetPasswordById(int id) {
    auto rows = storage::SecureDatabase::GetInstance().QueryPrepared(
        "SELECT id, title, encrypted_username, encrypted_password, encrypted_url, "
        "encrypted_notes, category, is_favorite, tags FROM passwords WHERE id = ?",
        [id](sqlite3_stmt* stmt) {
            sqlite3_bind_int(stmt, 1, id);
        });

    if (rows.empty() || rows[0].size() < 9) return std::nullopt;

    auto& row = rows[0];
    data::DecryptedPassword p = {};
    try { p.id = std::stoi(row[0]); } catch (...) { return std::nullopt; }
    p.title    = utils::StringUtils::Utf8ToWide(row[1]);
    p.username = DecryptFieldBase64(row[2]);
    p.password = DecryptFieldBase64(row[3]);
    p.url      = DecryptFieldBase64(row[4]);
    p.notes    = DecryptFieldBase64(row[5]);
    p.category = utils::StringUtils::Utf8ToWide(row[6]);
    try { p.isFavorite = std::stoi(row[7]) != 0; } catch (...) {}
    p.tags     = utils::StringUtils::Utf8ToWide(row[8]);
    return p;
}

bool PasswordRepository::SavePassword(const std::wstring& title, const std::wstring& username,
                                      const std::wstring& password, const std::wstring& url,
                                      const std::wstring& notes, const std::wstring& category,
                                      const std::wstring& tags) {
    try {
        std::string encUser  = EncryptFieldToBase64(username);
        std::string encPass  = EncryptFieldToBase64(password);
        std::string encUrl   = EncryptFieldToBase64(url);
        std::string encNotes = EncryptFieldToBase64(notes);
        std::string titleUtf8    = utils::StringUtils::WideToUtf8(title);
        std::string categoryUtf8 = utils::StringUtils::WideToUtf8(category);
        std::string tagsUtf8     = utils::StringUtils::WideToUtf8(tags);

        // iv column kept for schema compatibility; store empty blob
        bool ok = storage::SecureDatabase::GetInstance().InsertPrepared(
            "INSERT INTO passwords (title, encrypted_username, encrypted_password, "
            "encrypted_url, encrypted_notes, category, iv, tags) "
            "VALUES (?, ?, ?, ?, ?, ?, X'', ?)",
            [&](sqlite3_stmt* stmt) {
                sqlite3_bind_text(stmt, 1, titleUtf8.c_str(),    -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 2, encUser.c_str(),      -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 3, encPass.c_str(),      -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 4, encUrl.c_str(),       -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 5, encNotes.c_str(),     -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 6, categoryUtf8.c_str(), -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 7, tagsUtf8.c_str(),     -1, SQLITE_TRANSIENT);
            });

        if (ok) utils::Logger::GetInstance().Info(L"Password saved: " + title, L"PasswordRepository");
        return ok;
    } catch (const std::exception& e) {
        utils::Logger::GetInstance().Error(
            std::wstring(e.what(), e.what() + strlen(e.what())), L"PasswordRepository");
        return false;
    }
}

bool PasswordRepository::UpdatePassword(int id, const std::wstring& title, const std::wstring& username,
                                        const std::wstring& password, const std::wstring& url,
                                        const std::wstring& notes, const std::wstring& category,
                                        const std::wstring& tags) {
    try {
        std::string encUser  = EncryptFieldToBase64(username);
        std::string encPass  = EncryptFieldToBase64(password);
        std::string encUrl   = EncryptFieldToBase64(url);
        std::string encNotes = EncryptFieldToBase64(notes);
        std::string titleUtf8    = utils::StringUtils::WideToUtf8(title);
        std::string categoryUtf8 = utils::StringUtils::WideToUtf8(category);
        std::string tagsUtf8     = utils::StringUtils::WideToUtf8(tags);

        return storage::SecureDatabase::GetInstance().ExecutePrepared(
            "UPDATE passwords SET title=?, encrypted_username=?, encrypted_password=?, "
            "encrypted_url=?, encrypted_notes=?, category=?, tags=?, "
            "updated_at=strftime('%s','now') WHERE id=?",
            [&](sqlite3_stmt* stmt) {
                sqlite3_bind_text(stmt, 1, titleUtf8.c_str(),    -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 2, encUser.c_str(),      -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 3, encPass.c_str(),      -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 4, encUrl.c_str(),       -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 5, encNotes.c_str(),     -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 6, categoryUtf8.c_str(), -1, SQLITE_TRANSIENT);
                sqlite3_bind_text(stmt, 7, tagsUtf8.c_str(),     -1, SQLITE_TRANSIENT);
                sqlite3_bind_int (stmt, 8, id);
            });
    } catch (const std::exception& e) {
        utils::Logger::GetInstance().Error(
            std::wstring(e.what(), e.what() + strlen(e.what())), L"PasswordRepository");
        return false;
    }
}

bool PasswordRepository::DeletePassword(int id) {
    return storage::SecureDatabase::GetInstance().ExecutePrepared(
        "DELETE FROM passwords WHERE id = ?",
        [id](sqlite3_stmt* stmt) {
            sqlite3_bind_int(stmt, 1, id);
        });
}

bool PasswordRepository::ToggleFavorite(int id, bool isFavorite) {
    return storage::SecureDatabase::GetInstance().ExecutePrepared(
        "UPDATE passwords SET is_favorite = ? WHERE id = ?",
        [id, isFavorite](sqlite3_stmt* stmt) {
            sqlite3_bind_int(stmt, 1, isFavorite ? 1 : 0);
            sqlite3_bind_int(stmt, 2, id);
        });
}

bool PasswordRepository::IncrementAccessCount(int id) {
    return storage::SecureDatabase::GetInstance().ExecutePrepared(
        "UPDATE passwords SET access_count = access_count + 1, "
        "last_accessed = strftime('%s','now') WHERE id = ?",
        [id](sqlite3_stmt* stmt) {
            sqlite3_bind_int(stmt, 1, id);
        });
}

bool PasswordRepository::DeleteAll() {
    return storage::SecureDatabase::GetInstance().Execute("DELETE FROM passwords;");
}

int PasswordRepository::GetCount() {
    auto rows = storage::SecureDatabase::GetInstance().Query("SELECT COUNT(*) FROM passwords");
    if (rows.empty() || rows[0].empty()) return 0;
    try { return std::stoi(rows[0][0]); } catch (...) { return 0; }
}

data::DecryptedPassword PasswordRepository::DecryptEntry(const data::PasswordEntry& entry) {
    data::DecryptedPassword result;
    result.id          = entry.id;
    result.title       = entry.title;
    result.category    = entry.category;
    result.isFavorite  = entry.isFavorite;
    result.tags        = entry.tags;
    result.createdAt   = entry.createdAt;
    result.updatedAt   = entry.updatedAt;
    result.lastAccessed = entry.lastAccessed;
    result.accessCount = entry.accessCount;
    return result;
}

data::PasswordEntry PasswordRepository::EncryptEntry(const data::DecryptedPassword& entry) {
    data::PasswordEntry result;
    result.title      = entry.title;
    result.category   = entry.category;
    result.isFavorite = entry.isFavorite;
    result.tags       = entry.tags;
    return result;
}

}
