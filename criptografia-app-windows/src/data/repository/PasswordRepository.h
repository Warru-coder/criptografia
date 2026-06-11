#pragma once

#include "../data/model/Models.h"
#include <vector>
#include <string>
#include <optional>

namespace securecrypt::repository {

class PasswordRepository {
public:
    static PasswordRepository& GetInstance();
    
    bool Initialize();
    
    std::vector<data::DecryptedPassword> GetAllPasswords();
    
    std::vector<data::DecryptedPassword> SearchPasswords(const std::wstring& query);
    
    std::vector<data::DecryptedPassword> GetFavoritePasswords();
    
    std::optional<data::DecryptedPassword> GetPasswordById(int id);
    
    bool SavePassword(const std::wstring& title, const std::wstring& username,
                     const std::wstring& password, const std::wstring& url = L"",
                     const std::wstring& notes = L"", const std::wstring& category = L"",
                     const std::wstring& tags = L"");
    
    bool UpdatePassword(int id, const std::wstring& title, const std::wstring& username,
                       const std::wstring& password, const std::wstring& url = L"",
                       const std::wstring& notes = L"", const std::wstring& category = L"",
                       const std::wstring& tags = L"");
    
    bool DeletePassword(int id);
    
    bool ToggleFavorite(int id, bool isFavorite);
    
    bool IncrementAccessCount(int id);
    
    bool DeleteAll();
    
    int GetCount();

private:
    PasswordRepository();
    ~PasswordRepository();
    
    data::DecryptedPassword DecryptEntry(const data::PasswordEntry& entry);
    data::PasswordEntry EncryptEntry(const data::DecryptedPassword& entry);
};

}
