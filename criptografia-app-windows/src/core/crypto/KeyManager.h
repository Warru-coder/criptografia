#pragma once

#include <windows.h>
#include <dpapi.h>
#include <vector>
#include <string>
#include <mutex>

namespace securecrypt::crypto {

class KeyManager {
public:
    static KeyManager& GetInstance();
    
    KeyManager(const KeyManager&) = delete;
    KeyManager& operator=(const KeyManager&) = delete;
    
    bool Initialize(const std::wstring& masterPassword);
    
    bool IsInitialized() const;
    
    std::vector<BYTE> GetEncryptionKey();
    
    std::vector<BYTE> GetAuthenticationKey();
    
    bool ChangeMasterPassword(const std::wstring& oldPassword, const std::wstring& newPassword);
    
    bool VerifyMasterPassword(const std::wstring& password);
    
    void Lock();
    
    void Unlock(const std::wstring& password);
    
    bool IsLocked() const;
    
    void ClearKeys();
    
    std::wstring GetKeyFilePath() const;

private:
    KeyManager();
    ~KeyManager();
    
    mutable std::mutex m_mutex;
    bool m_isInitialized;
    bool m_isLocked;
    std::vector<BYTE> m_encryptionKey;
    std::vector<BYTE> m_authenticationKey;
    std::vector<BYTE> m_passwordHash;
    
    std::wstring m_keyFilePath;
    
    bool ProtectData(const std::vector<BYTE>& input, std::vector<BYTE>& output);
    bool UnprotectData(const std::vector<BYTE>& input, std::vector<BYTE>& output);
    
    std::vector<BYTE> HashPassword(const std::wstring& password);
    
    void CreateSecureDirectory();
};

}
