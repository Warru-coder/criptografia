#pragma once

#include <windows.h>
#include <bcrypt.h>
#include <vector>
#include <string>
#include <memory>
#include <stdexcept>

namespace securecrypt::crypto {

constexpr size_t AES_KEY_SIZE = 32;
constexpr size_t GCM_IV_SIZE = 16;
constexpr size_t GCM_TAG_SIZE = 16;
constexpr size_t SALT_SIZE = 16;
// OWASP recommendation for PBKDF2-HMAC-SHA256 (2023+)
constexpr size_t PBKDF2_ITERATIONS = 600000;
constexpr size_t HASH_SIZE = 32;

struct EncryptedData {
    std::vector<BYTE> ciphertext;
    std::vector<BYTE> iv;
    std::vector<BYTE> authTag;
    FILETIME timestamp;
};

struct FileEncryptionResult {
    bool success;
    std::wstring outputPath;
    std::vector<BYTE> hmac;
    ULONGLONG originalSize;
    std::wstring error;
};

class CryptoEngine {
public:
    CryptoEngine();
    ~CryptoEngine();
    
    CryptoEngine(const CryptoEngine&) = delete;
    CryptoEngine& operator=(const CryptoEngine&) = delete;
    
    std::vector<BYTE> GenerateRandomBytes(size_t size);
    
    EncryptedData EncryptData(const std::vector<BYTE>& plaintext, const std::vector<BYTE>& key);
    
    std::vector<BYTE> DecryptData(const EncryptedData& encryptedData, const std::vector<BYTE>& key);
    
    std::vector<BYTE> DeriveKey(const std::wstring& password, const std::vector<BYTE>& salt, size_t keyLength = AES_KEY_SIZE);
    
    std::vector<BYTE> ComputeHash(const std::vector<BYTE>& data);
    
    std::vector<BYTE> ComputeHMAC(const std::vector<BYTE>& data, const std::vector<BYTE>& key);
    
    bool VerifyHMAC(const std::vector<BYTE>& data, const std::vector<BYTE>& key, const std::vector<BYTE>& expectedHMAC);
    
    FileEncryptionResult EncryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key);
    
    FileEncryptionResult DecryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key);
    
    static std::wstring GetLastErrorString();

private:
    BCRYPT_ALG_HANDLE m_hAesAlg;
    BCRYPT_ALG_HANDLE m_hHashAlg;
    BCRYPT_ALG_HANDLE m_hPbkdf2Alg;
    
    void CheckStatus(NTSTATUS status, const std::string& context);
    
    std::vector<BYTE> AesGcmEncrypt(const std::vector<BYTE>& plaintext, const std::vector<BYTE>& key, std::vector<BYTE>& iv, std::vector<BYTE>& authTag);
    
    std::vector<BYTE> AesGcmDecrypt(const std::vector<BYTE>& ciphertext, const std::vector<BYTE>& key, const std::vector<BYTE>& iv, const std::vector<BYTE>& authTag);
};

}
