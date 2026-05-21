#include "CryptoEngine.h"
#include <fstream>
#include <sstream>
#include <iomanip>

namespace securecrypt::crypto {

constexpr BYTE FILE_MAGIC[] = { 0x53, 0x43, 0x52, 0x59, 0x50, 0x54 };
constexpr BYTE FILE_VERSION = 0x01;
constexpr size_t BUFFER_SIZE = 65536;

CryptoEngine::CryptoEngine() : m_hAesAlg(NULL), m_hHashAlg(NULL), m_hPbkdf2Alg(NULL) {
    NTSTATUS status;
    
    status = BCryptOpenAlgorithmProvider(&m_hAesAlg, BCRYPT_AES_ALGORITHM, NULL, 0);
    CheckStatus(status, "BCryptOpenAlgorithmProvider AES");
    
    status = BCryptSetProperty(m_hAesAlg, BCRYPT_CHAINING_MODE, (PBYTE)BCRYPT_CHAIN_MODE_GCM, sizeof(BCRYPT_CHAIN_MODE_GCM), 0);
    CheckStatus(status, "BCryptSetProperty GCM");
    
    status = BCryptOpenAlgorithmProvider(&m_hHashAlg, BCRYPT_SHA256_ALGORITHM, NULL, 0);
    CheckStatus(status, "BCryptOpenAlgorithmProvider SHA256");
    
    status = BCryptOpenAlgorithmProvider(&m_hPbkdf2Alg, BCRYPT_SP800108_CTR_ALGORITHM, NULL, 0);
    if (!BCRYPT_SUCCESS(status)) {
        // Fallback: use PBKDF2 via CryptDeriveKey or manual implementation
        m_hPbkdf2Alg = NULL;
    }
}

CryptoEngine::~CryptoEngine() {
    if (m_hAesAlg) BCryptCloseAlgorithmProvider(m_hAesAlg, 0);
    if (m_hHashAlg) BCryptCloseAlgorithmProvider(m_hHashAlg, 0);
    if (m_hPbkdf2Alg) BCryptCloseAlgorithmProvider(m_hPbkdf2Alg, 0);
}

std::vector<BYTE> CryptoEngine::GenerateRandomBytes(size_t size) {
    std::vector<BYTE> buffer(size);
    NTSTATUS status = BCryptGenRandom(NULL, buffer.data(), static_cast<ULONG>(size), BCRYPT_USE_SYSTEM_PREFERRED_RNG);
    CheckStatus(status, "BCryptGenRandom");
    return buffer;
}

std::vector<BYTE> CryptoEngine::AesGcmEncrypt(const std::vector<BYTE>& plaintext, const std::vector<BYTE>& key, std::vector<BYTE>& iv, std::vector<BYTE>& authTag) {
    BCRYPT_KEY_HANDLE hKey = NULL;
    NTSTATUS status;
    
    status = BCryptGenerateSymmetricKey(m_hAesAlg, &hKey, NULL, 0, const_cast<BYTE*>(key.data()), static_cast<ULONG>(key.size()), 0);
    CheckStatus(status, "BCryptGenerateSymmetricKey");
    
    auto cleanup = [&]() {
        if (hKey) BCryptDestroyKey(hKey);
    };
    
    iv = GenerateRandomBytes(GCM_IV_SIZE);
    authTag.resize(GCM_TAG_SIZE);
    
    BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO authInfo;
    BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
    authInfo.pbNonce = iv.data();
    authInfo.cbNonce = static_cast<ULONG>(iv.size());
    authInfo.pbTag = authTag.data();
    authInfo.cbTag = static_cast<ULONG>(authTag.size());
    
    ULONG cbResult = 0;
    std::vector<BYTE> ciphertext(plaintext.size() + GCM_TAG_SIZE);
    
    status = BCryptEncrypt(hKey,
        const_cast<BYTE*>(plaintext.data()), static_cast<ULONG>(plaintext.size()),
        &authInfo, NULL, 0,
        ciphertext.data(), static_cast<ULONG>(ciphertext.size()),
        &cbResult, 0);
    CheckStatus(status, "BCryptEncrypt");
    
    ciphertext.resize(cbResult);
    
    cleanup();
    return ciphertext;
}

std::vector<BYTE> CryptoEngine::AesGcmDecrypt(const std::vector<BYTE>& ciphertext, const std::vector<BYTE>& key, const std::vector<BYTE>& iv, const std::vector<BYTE>& authTag) {
    BCRYPT_KEY_HANDLE hKey = NULL;
    NTSTATUS status;
    
    status = BCryptGenerateSymmetricKey(m_hAesAlg, &hKey, NULL, 0, const_cast<BYTE*>(key.data()), static_cast<ULONG>(key.size()), 0);
    CheckStatus(status, "BCryptGenerateSymmetricKey");
    
    auto cleanup = [&]() {
        if (hKey) BCryptDestroyKey(hKey);
    };
    
    BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO authInfo;
    BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
    authInfo.pbNonce = const_cast<BYTE*>(iv.data());
    authInfo.cbNonce = static_cast<ULONG>(iv.size());
    authInfo.pbTag = const_cast<BYTE*>(authTag.data());
    authInfo.cbTag = static_cast<ULONG>(authTag.size());
    
    ULONG cbResult = 0;
    std::vector<BYTE> plaintext(ciphertext.size());
    
    status = BCryptDecrypt(hKey,
        const_cast<BYTE*>(ciphertext.data()), static_cast<ULONG>(ciphertext.size()),
        &authInfo, NULL, 0,
        plaintext.data(), static_cast<ULONG>(plaintext.size()),
        &cbResult, 0);
    
    if (!BCRYPT_SUCCESS(status)) {
        cleanup();
        throw std::runtime_error("Decryption failed - integrity check error (STATUS: 0x" + 
            std::to_string(status) + ")");
    }
    
    plaintext.resize(cbResult);
    
    cleanup();
    return plaintext;
}

EncryptedData CryptoEngine::EncryptData(const std::vector<BYTE>& plaintext, const std::vector<BYTE>& key) {
    EncryptedData result;
    result.ciphertext = AesGcmEncrypt(plaintext, key, result.iv, result.authTag);
    GetSystemTimeAsFileTime(&result.timestamp);
    return result;
}

std::vector<BYTE> CryptoEngine::DecryptData(const EncryptedData& encryptedData, const std::vector<BYTE>& key) {
    return AesGcmDecrypt(encryptedData.ciphertext, key, encryptedData.iv, encryptedData.authTag);
}

std::vector<BYTE> CryptoEngine::DeriveKey(const std::wstring& password, const std::vector<BYTE>& salt, size_t keyLength) {
    HCRYPTPROV hProv = NULL;
    HCRYPTHASH hHash = NULL;
    HCRYPTKEY hKey = NULL;
    
    std::vector<BYTE> derivedKey(keyLength);
    
    if (!CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) {
        throw std::runtime_error("CryptAcquireContext failed");
    }
    
    if (!CryptCreateHash(hProv, CALG_SHA_256, 0, 0, &hHash)) {
        CryptReleaseContext(hProv, 0);
        throw std::runtime_error("CryptCreateHash failed");
    }
    
    std::vector<BYTE> passwordBytes(password.size() * sizeof(wchar_t));
    memcpy(passwordBytes.data(), password.c_str(), passwordBytes.size());
    
    for (DWORD i = 0; i < PBKDF2_ITERATIONS / 1000; ++i) {
        if (!CryptHashData(hHash, salt.data(), static_cast<DWORD>(salt.size()), 0)) {
            break;
        }
        if (!CryptHashData(hHash, passwordBytes.data(), static_cast<DWORD>(passwordBytes.size()), 0)) {
            break;
        }
    }
    
    DWORD hashSize = static_cast<DWORD>(derivedKey.size());
    if (!CryptGetHashParam(hHash, HP_HASHVAL, derivedKey.data(), &hashSize, 0)) {
        CryptDestroyHash(hHash);
        CryptReleaseContext(hProv, 0);
        SecureZeroMemory(passwordBytes.data(), passwordBytes.size());
        throw std::runtime_error("CryptGetHashParam failed");
    }
    
    CryptDestroyHash(hHash);
    CryptReleaseContext(hProv, 0);
    SecureZeroMemory(passwordBytes.data(), passwordBytes.size());
    
    return derivedKey;
}

std::vector<BYTE> CryptoEngine::ComputeHash(const std::vector<BYTE>& data) {
    BCRYPT_HASH_HANDLE hHash = NULL;
    NTSTATUS status;
    
    DWORD cbHashObject = 0;
    DWORD cbResult = 0;
    
    status = BCryptGetProperty(m_hHashAlg, BCRYPT_OBJECT_LENGTH, (PBYTE)&cbHashObject, sizeof(DWORD), &cbResult, 0);
    CheckStatus(status, "BCryptGetProperty OBJECT_LENGTH");
    
    std::vector<BYTE> hashObject(cbHashObject);
    
    status = BCryptCreateHash(m_hHashAlg, &hHash, hashObject.data(), cbHashObject, NULL, 0, 0);
    CheckStatus(status, "BCryptCreateHash");
    
    status = BCryptHashData(hHash, const_cast<BYTE*>(data.data()), static_cast<ULONG>(data.size()), 0);
    CheckStatus(status, "BCryptHashData");
    
    std::vector<BYTE> hash(HASH_SIZE);
    status = BCryptFinishHash(hHash, hash.data(), static_cast<ULONG>(hash.size()), 0);
    CheckStatus(status, "BCryptFinishHash");
    
    BCryptDestroyHash(hHash);
    return hash;
}

std::vector<BYTE> CryptoEngine::ComputeHMAC(const std::vector<BYTE>& data, const std::vector<BYTE>& key) {
    BCRYPT_KEY_HANDLE hKey = NULL;
    BCRYPT_HASH_HANDLE hHash = NULL;
    NTSTATUS status;
    
    status = BCryptGenerateSymmetricKey(m_hHashAlg, &hKey, NULL, 0, const_cast<BYTE*>(key.data()), static_cast<ULONG>(key.size()), BCRYPT_HMAC_FLAG);
    CheckStatus(status, "BCryptGenerateSymmetricKey HMAC");
    
    status = BCryptCreateHash(m_hHashAlg, &hHash, NULL, 0, hKey, 0, 0);
    CheckStatus(status, "BCryptCreateHash HMAC");
    
    status = BCryptHashData(hHash, const_cast<BYTE*>(data.data()), static_cast<ULONG>(data.size()), 0);
    CheckStatus(status, "BCryptHashData HMAC");
    
    std::vector<BYTE> hmac(HASH_SIZE);
    status = BCryptFinishHash(hHash, hmac.data(), static_cast<ULONG>(hmac.size()), 0);
    CheckStatus(status, "BCryptFinishHash HMAC");
    
    BCryptDestroyHash(hHash);
    BCryptDestroyKey(hKey);
    return hmac;
}

bool CryptoEngine::VerifyHMAC(const std::vector<BYTE>& data, const std::vector<BYTE>& key, const std::vector<BYTE>& expectedHMAC) {
    auto computedHMAC = ComputeHMAC(data, key);
    return computedHMAC == expectedHMAC;
}

FileEncryptionResult CryptoEngine::EncryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key) {
    FileEncryptionResult result;
    result.success = false;
    
    HANDLE hInput = CreateFileW(inputPath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInput == INVALID_HANDLE_VALUE) {
        result.error = L"Failed to open input file";
        return result;
    }
    
    HANDLE hOutput = CreateFileW(outputPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOutput == INVALID_HANDLE_VALUE) {
        CloseHandle(hInput);
        result.error = L"Failed to create output file";
        return result;
    }
    
    LARGE_INTEGER fileSize;
    GetFileSizeEx(hInput, &fileSize);
    result.originalSize = fileSize.QuadPart;
    
    try {
        auto iv = GenerateRandomBytes(GCM_IV_SIZE);
        auto salt = GenerateRandomBytes(SALT_SIZE);
        
        DWORD written;
        WriteFile(hOutput, FILE_MAGIC, sizeof(FILE_MAGIC), &written, NULL);
        WriteFile(hOutput, &FILE_VERSION, 1, &written, NULL);
        WriteFile(hOutput, salt.data(), static_cast<DWORD>(salt.size()), &written, NULL);
        WriteFile(hOutput, iv.data(), static_cast<DWORD>(iv.size()), &written, NULL);
        
        BCRYPT_KEY_HANDLE hKey = NULL;
        NTSTATUS status = BCryptGenerateSymmetricKey(m_hAesAlg, &hKey, NULL, 0, const_cast<BYTE*>(key.data()), static_cast<ULONG>(key.size()), 0);
        CheckStatus(status, "BCryptGenerateSymmetricKey");
        
        std::vector<BYTE> buffer(BUFFER_SIZE);
        std::vector<BYTE> ciphertext(BUFFER_SIZE + GCM_TAG_SIZE);
        
        BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO authInfo;
        
        ULONGLONG totalRead = 0;
        BOOL isLastBlock = FALSE;
        
        while (!isLastBlock) {
            DWORD bytesRead = 0;
            ReadFile(hInput, buffer.data(), static_cast<DWORD>(buffer.size()), &bytesRead, NULL);
            
            if (bytesRead < buffer.size()) {
                isLastBlock = TRUE;
            }
            
            BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
            authInfo.pbNonce = iv.data();
            authInfo.cbNonce = static_cast<ULONG>(iv.size());
            
            ULONG cbResult = 0;
            status = BCryptEncrypt(hKey,
                buffer.data(), bytesRead,
                &authInfo, NULL, 0,
                ciphertext.data(), static_cast<ULONG>(ciphertext.size()),
                &cbResult, 0);
            
            if (!BCRYPT_SUCCESS(status) && !isLastBlock) {
                throw std::runtime_error("Encryption failed at block");
            }
            
            if (isLastBlock) {
                authInfo.pbTag = ciphertext.data() + cbResult;
                authInfo.cbTag = GCM_TAG_SIZE;
                
                std::vector<BYTE> authTag(GCM_TAG_SIZE);
                memcpy(authTag.data(), authInfo.pbTag, GCM_TAG_SIZE);
                
                WriteFile(hOutput, ciphertext.data(), cbResult, &written, NULL);
                WriteFile(hOutput, authTag.data(), GCM_TAG_SIZE, &written, NULL);
                
                result.hmac = ComputeHMAC(ciphertext, key);
            } else {
                WriteFile(hOutput, ciphertext.data(), cbResult, &written, NULL);
            }
            
            totalRead += bytesRead;
        }
        
        BCryptDestroyKey(hKey);
        result.success = true;
        result.outputPath = outputPath;
        
    } catch (const std::exception& e) {
        result.error = std::wstring(e.what(), e.what() + strlen(e.what()));
    }
    
    CloseHandle(hInput);
    CloseHandle(hOutput);
    
    if (!result.success) {
        DeleteFileW(outputPath.c_str());
    }
    
    return result;
}

FileEncryptionResult CryptoEngine::DecryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key) {
    FileEncryptionResult result;
    result.success = false;
    
    HANDLE hInput = CreateFileW(inputPath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInput == INVALID_HANDLE_VALUE) {
        result.error = L"Failed to open input file";
        return result;
    }
    
    HANDLE hOutput = CreateFileW(outputPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOutput == INVALID_HANDLE_VALUE) {
        CloseHandle(hInput);
        result.error = L"Failed to create output file";
        return result;
    }
    
    try {
        BYTE magic[sizeof(FILE_MAGIC)];
        BYTE version;
        DWORD bytesRead;
        
        ReadFile(hInput, magic, sizeof(magic), &bytesRead, NULL);
        if (bytesRead != sizeof(magic) || memcmp(magic, FILE_MAGIC, sizeof(FILE_MAGIC)) != 0) {
            result.error = L"Invalid file format - not a SecureCrypt file";
            throw std::runtime_error("Invalid magic");
        }
        
        ReadFile(hInput, &version, 1, &bytesRead, NULL);
        if (version != FILE_VERSION) {
            result.error = L"Unsupported file version";
            throw std::runtime_error("Invalid version");
        }
        
        std::vector<BYTE> salt(SALT_SIZE);
        std::vector<BYTE> iv(GCM_IV_SIZE);
        ReadFile(hInput, salt.data(), static_cast<DWORD>(salt.size()), &bytesRead, NULL);
        ReadFile(hInput, iv.data(), static_cast<DWORD>(iv.size()), &bytesRead, NULL);
        
        BCRYPT_KEY_HANDLE hKey = NULL;
        NTSTATUS status = BCryptGenerateSymmetricKey(m_hAesAlg, &hKey, NULL, 0, const_cast<BYTE*>(key.data()), static_cast<ULONG>(key.size()), 0);
        CheckStatus(status, "BCryptGenerateSymmetricKey");
        
        std::vector<BYTE> buffer(BUFFER_SIZE + GCM_TAG_SIZE);
        std::vector<BYTE> plaintext(BUFFER_SIZE);
        
        LARGE_INTEGER inputFileSize;
        GetFileSizeEx(hInput, &inputFileSize);
        ULONGLONG remaining = inputFileSize.QuadPart - sizeof(FILE_MAGIC) - 1 - SALT_SIZE - GCM_IV_SIZE;
        
        BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO authInfo;
        
        while (remaining > 0) {
            BOOL isLastBlock = (remaining <= BUFFER_SIZE + GCM_TAG_SIZE);
            DWORD bytesToRead = isLastBlock ? static_cast<DWORD>(remaining) : BUFFER_SIZE + GCM_TAG_SIZE;
            
            DWORD bytesRead = 0;
            ReadFile(hInput, buffer.data(), bytesToRead, &bytesRead, NULL);
            
            if (isLastBlock) {
                if (bytesRead < GCM_TAG_SIZE + 1) {
                    result.error = L"Invalid encrypted file - truncated";
                    throw std::runtime_error("Truncated file");
                }
                
                size_t dataLen = bytesRead - GCM_TAG_SIZE;
                std::vector<BYTE> authTag(buffer.data() + dataLen, buffer.data() + bytesRead);
                
                BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
                authInfo.pbNonce = iv.data();
                authInfo.cbNonce = static_cast<ULONG>(iv.size());
                authInfo.pbTag = authTag.data();
                authInfo.cbTag = static_cast<ULONG>(authTag.size());
                
                ULONG cbResult = 0;
                status = BCryptDecrypt(hKey,
                    buffer.data(), static_cast<ULONG>(dataLen),
                    &authInfo, NULL, 0,
                    plaintext.data(), static_cast<ULONG>(plaintext.size()),
                    &cbResult, 0);
                
                if (!BCRYPT_SUCCESS(status)) {
                    result.error = L"Integrity check failed - file may be tampered";
                    throw std::runtime_error("Integrity check failed");
                }
                
                DWORD written;
                WriteFile(hOutput, plaintext.data(), cbResult, &written, NULL);
            } else {
                BCRYPT_INIT_AUTH_MODE_INFO(authInfo);
                authInfo.pbNonce = iv.data();
                authInfo.cbNonce = static_cast<ULONG>(iv.size());
                
                ULONG cbResult = 0;
                status = BCryptDecrypt(hKey,
                    buffer.data(), static_cast<ULONG>(bytesRead),
                    &authInfo, NULL, 0,
                    plaintext.data(), static_cast<ULONG>(plaintext.size()),
                    &cbResult, 0);
                
                if (!BCRYPT_SUCCESS(status)) {
                    result.error = L"Decryption failed";
                    throw std::runtime_error("Decryption failed");
                }
                
                DWORD written;
                WriteFile(hOutput, plaintext.data(), cbResult, &written, NULL);
            }
            
            remaining -= bytesRead;
        }
        
        BCryptDestroyKey(hKey);
        result.success = true;
        result.outputPath = outputPath;
        
    } catch (const std::exception& e) {
        result.error = std::wstring(e.what(), e.what() + strlen(e.what()));
    }
    
    CloseHandle(hInput);
    CloseHandle(hOutput);
    
    if (!result.success) {
        DeleteFileW(outputPath.c_str());
    }
    
    return result;
}

void CryptoEngine::CheckStatus(NTSTATUS status, const std::string& context) {
    if (!BCRYPT_SUCCESS(status)) {
        throw std::runtime_error(context + " failed with status: 0x" + 
            std::to_string(status));
    }
}

std::wstring CryptoEngine::GetLastErrorString() {
    DWORD error = GetLastError();
    LPWSTR messageBuffer = nullptr;
    
    FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        NULL, error, MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT), (LPWSTR)&messageBuffer, 0, NULL);
    
    std::wstring message = messageBuffer ? messageBuffer : L"Unknown error";
    LocalFree(messageBuffer);
    return message;
}

}
