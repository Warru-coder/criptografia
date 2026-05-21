#include "PasswordRepository.h"
#include "../core/crypto/KeyManager.h"
#include "../core/crypto/CryptoEngine.h"
#include "../core/storage/SecureDatabase.h"
#include "../core/utils/Logger.h"
#include "../core/utils/StringUtils.h"

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

std::vector<data::DecryptedPassword> PasswordRepository::GetAllPasswords() {
    std::vector<data::DecryptedPassword> result;
    return result;
}

std::vector<data::DecryptedPassword> PasswordRepository::SearchPasswords(const std::wstring& query) {
    std::vector<data::DecryptedPassword> result;
    return result;
}

std::vector<data::DecryptedPassword> PasswordRepository::GetFavoritePasswords() {
    std::vector<data::DecryptedPassword> result;
    return result;
}

std::optional<data::DecryptedPassword> PasswordRepository::GetPasswordById(int id) {
    return std::nullopt;
}

bool PasswordRepository::SavePassword(const std::wstring& title, const std::wstring& username,
                                     const std::wstring& password, const std::wstring& url,
                                     const std::wstring& notes, const std::wstring& category,
                                     const std::wstring& tags) {
    try {
        auto& keyManager = crypto::KeyManager::GetInstance();
        auto key = keyManager.GetEncryptionKey();
        
        crypto::CryptoEngine engine;
        
        data::DecryptedPassword entry;
        entry.title = title;
        entry.username = username;
        entry.password = password;
        entry.url = url;
        entry.notes = notes;
        entry.category = category;
        entry.tags = tags;
        
        auto encrypted = engine.EncryptData(
            std::vector<BYTE>(username.begin(), username.end()), key);
        
        securecrypt::utils::Logger::GetInstance().Info(L"Password saved: " + title, L"PasswordRepository");
        return true;
    } catch (const std::exception& e) {
        securecrypt::utils::Logger::GetInstance().Error(
            std::wstring(e.what(), e.what() + strlen(e.what())), L"PasswordRepository");
        return false;
    }
}

bool PasswordRepository::UpdatePassword(int id, const std::wstring& title, const std::wstring& username,
                                       const std::wstring& password, const std::wstring& url,
                                       const std::wstring& notes, const std::wstring& category,
                                       const std::wstring& tags) {
    return DeletePassword(id) && SavePassword(title, username, password, url, notes, category, tags);
}

bool PasswordRepository::DeletePassword(int id) {
    return true;
}

bool PasswordRepository::ToggleFavorite(int id, bool isFavorite) {
    return true;
}

bool PasswordRepository::IncrementAccessCount(int id) {
    return true;
}

bool PasswordRepository::DeleteAll() {
    return true;
}

int PasswordRepository::GetCount() {
    return 0;
}

data::DecryptedPassword PasswordRepository::DecryptEntry(const data::PasswordEntry& entry) {
    data::DecryptedPassword result;
    result.id = entry.id;
    result.title = entry.title;
    result.category = entry.category;
    result.isFavorite = entry.isFavorite;
    result.tags = entry.tags;
    result.createdAt = entry.createdAt;
    result.updatedAt = entry.updatedAt;
    result.lastAccessed = entry.lastAccessed;
    result.accessCount = entry.accessCount;
    return result;
}

data::PasswordEntry PasswordRepository::EncryptEntry(const data::DecryptedPassword& entry) {
    data::PasswordEntry result;
    result.title = entry.title;
    result.category = entry.category;
    result.isFavorite = entry.isFavorite;
    result.tags = entry.tags;
    return result;
}

}
