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

    bool Unlock(const std::wstring& password);

    void Lock();

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
    std::vector<BYTE> m_passwordSalt; // SEC-005: salt stored for deterministic verification

    std::wstring m_keyFilePath;

    bool ProtectData(const std::vector<BYTE>& input, std::vector<BYTE>& output);
    bool UnprotectData(const std::vector<BYTE>& input, std::vector<BYTE>& output);

    // Accepts an explicit salt — never generates its own (SEC-005)
    std::vector<BYTE> HashPasswordWithSalt(const std::wstring& password, const std::vector<BYTE>& salt);

    // SEC-003: constant-time byte comparison to prevent timing attacks
    static bool ConstantTimeEqual(const std::vector<BYTE>& a, const std::vector<BYTE>& b);

    // Internal verify — caller must already hold m_mutex (SEC-005: no deadlock)
    bool VerifyMasterPasswordLocked(const std::wstring& password);

    bool LoadHashFile();
    bool SaveHashFile();

    void CreateSecureDirectory();
};

}
