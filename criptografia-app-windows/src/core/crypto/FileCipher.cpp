#include "FileCipher.h"
#include "../crypto/CryptoEngine.h"
#include "../utils/PathUtils.h"
#include "../utils/Logger.h"
#include "../security/SecureMemory.h"

namespace securecrypt::crypto {

bool FileCipher::EncryptFile(const std::wstring& inputPath, const std::wstring& outputPath,
                            const std::vector<BYTE>& key, ProgressCallback callback) {
    CryptoEngine engine;
    auto result = engine.EncryptFile(inputPath, outputPath, key);
    
    if (result.success) {
        securecrypt::utils::Logger::GetInstance().Info(
            L"File encrypted: " + securecrypt::utils::PathUtils::GetFileName(inputPath),
            L"FileCipher");
    } else {
        securecrypt::utils::Logger::GetInstance().Error(
            L"File encryption failed: " + result.error,
            L"FileCipher");
    }
    
    return result.success;
}

bool FileCipher::DecryptFile(const std::wstring& inputPath, const std::wstring& outputPath,
                            const std::vector<BYTE>& key, ProgressCallback callback) {
    CryptoEngine engine;
    auto result = engine.DecryptFile(inputPath, outputPath, key);
    
    if (result.success) {
        securecrypt::utils::Logger::GetInstance().Info(
            L"File decrypted: " + securecrypt::utils::PathUtils::GetFileName(inputPath),
            L"FileCipher");
    } else {
        securecrypt::utils::Logger::GetInstance().Error(
            L"File decryption failed: " + result.error,
            L"FileCipher");
    }
    
    return result.success;
}

bool FileCipher::VerifyFileIntegrity(const std::wstring& filePath, const std::vector<BYTE>& key) {
    if (!securecrypt::utils::PathUtils::FileExists(filePath)) {
        return false;
    }
    
    HANDLE hFile = CreateFileW(filePath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile == INVALID_HANDLE_VALUE) return false;
    
    BYTE magic[sizeof(FILE_MAGIC)];
    BYTE version;
    DWORD bytesRead;
    
    ReadFile(hFile, magic, sizeof(magic), &bytesRead, NULL);
    if (bytesRead != sizeof(magic) || memcmp(magic, FILE_MAGIC, sizeof(FILE_MAGIC)) != 0) {
        CloseHandle(hFile);
        return false;
    }
    
    ReadFile(hFile, &version, 1, &bytesRead, NULL);
    if (version != FILE_VERSION) {
        CloseHandle(hFile);
        return false;
    }
    
    std::vector<BYTE> salt(SALT_SIZE);
    std::vector<BYTE> iv(GCM_IV_SIZE);
    ReadFile(hFile, salt.data(), static_cast<DWORD>(salt.size()), &bytesRead, NULL);
    ReadFile(hFile, iv.data(), static_cast<DWORD>(iv.size()), &bytesRead, NULL);
    
    CloseHandle(hFile);
    return true;
}

std::wstring FileCipher::GetFileExtension(const std::wstring& filePath) {
    return securecrypt::utils::PathUtils::GetExtension(filePath);
}

bool FileCipher::IsSecureCryptFile(const std::wstring& filePath) {
    if (!securecrypt::utils::PathUtils::FileExists(filePath)) return false;
    
    std::wstring ext = securecrypt::utils::PathUtils::GetExtension(filePath);
    return ext == L".scrypt";
}

ULONGLONG FileCipher::GetOriginalFileSize(const std::wstring& encryptedPath) {
    return securecrypt::utils::PathUtils::GetFileSize(encryptedPath);
}

}
