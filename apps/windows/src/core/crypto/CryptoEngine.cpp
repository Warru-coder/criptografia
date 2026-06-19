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

    // CRIT-01 fix / ADR-0003: open SHA-256 in HMAC mode for BCryptDeriveKeyPBKDF2.
    status = BCryptOpenAlgorithmProvider(&m_hPbkdf2Alg, BCRYPT_SHA256_ALGORITHM, NULL, BCRYPT_ALG_HANDLE_HMAC_FLAG);
    CheckStatus(status, "BCryptOpenAlgorithmProvider HMAC-SHA256 (PBKDF2)");
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

// CRIT-01 fix / ADR-0003: real PBKDF2-HMAC-SHA256 via BCryptDeriveKeyPBKDF2.
// Previous implementation iterated CryptHashData without finalizing → constant-time
// single SHA-256 regardless of PBKDF2_ITERATIONS. This made the announced
// "600.000 iterations" purely cosmetic. We now use the CNG primitive.
//
// Password encoding: UTF-8 (was UTF-16 in the broken version). UTF-8 is the
// portable convention; the rest of the codebase (Node/Web) uses UTF-8 implicitly.
// Files produced before this fix are NOT decryptable with this function; they
// must go through a legacy path or be re-encrypted.
std::vector<BYTE> CryptoEngine::DeriveKey(const std::wstring& password, const std::vector<BYTE>& salt, size_t keyLength) {
    if (!m_hPbkdf2Alg) {
        throw std::runtime_error("HMAC-SHA256 provider not initialised — cannot derive key");
    }

    // Convert wide-string password to UTF-8 bytes.
    int utf8Len = WideCharToMultiByte(CP_UTF8, 0, password.c_str(), static_cast<int>(password.size()), NULL, 0, NULL, NULL);
    if (utf8Len <= 0) {
        throw std::runtime_error("Password UTF-8 conversion failed");
    }
    std::vector<BYTE> passwordBytes(utf8Len);
    WideCharToMultiByte(CP_UTF8, 0, password.c_str(), static_cast<int>(password.size()),
                        reinterpret_cast<LPSTR>(passwordBytes.data()), utf8Len, NULL, NULL);

    std::vector<BYTE> derivedKey(keyLength);

    NTSTATUS status = BCryptDeriveKeyPBKDF2(
        m_hPbkdf2Alg,
        passwordBytes.data(), static_cast<ULONG>(passwordBytes.size()),
        const_cast<PUCHAR>(salt.data()), static_cast<ULONG>(salt.size()),
        static_cast<ULONGLONG>(PBKDF2_ITERATIONS),
        derivedKey.data(), static_cast<ULONG>(derivedKey.size()),
        0);

    SecureZeroMemory(passwordBytes.data(), passwordBytes.size());

    if (!BCRYPT_SUCCESS(status)) {
        SecureZeroMemory(derivedKey.data(), derivedKey.size());
        throw std::runtime_error("BCryptDeriveKeyPBKDF2 failed with status 0x" + std::to_string(status));
    }

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

// CRIT-02 fix / ADR-0004: the previous streaming implementation reused the same IV
// per block AND only stored the tag of the last block, producing files that were
// neither confidential (nonce reuse in GCM) nor authenticated (tag did not cover
// the whole file).
//
// Interim Fase-1 fix: load the file in memory and run a single AES-GCM operation.
// This is the same code path as AesGcmEncrypt(), which is correct.
// Limit: 256 MiB — files larger than that should use the streaming Node/Web
// engine until ADR-0001 (libsodium crypto_secretstream) lands in Fase 2.
constexpr ULONGLONG MAX_INMEM_ENCRYPT_BYTES = 256ULL * 1024 * 1024;
constexpr BYTE FILE_VERSION_V2 = 0x02;

FileEncryptionResult CryptoEngine::EncryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key) {
    FileEncryptionResult result;
    result.success = false;

    HANDLE hInput = CreateFileW(inputPath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInput == INVALID_HANDLE_VALUE) {
        result.error = L"Failed to open input file";
        return result;
    }

    LARGE_INTEGER fileSize;
    GetFileSizeEx(hInput, &fileSize);
    result.originalSize = fileSize.QuadPart;

    if (static_cast<ULONGLONG>(fileSize.QuadPart) > MAX_INMEM_ENCRYPT_BYTES) {
        CloseHandle(hInput);
        result.error = L"File too large for current C++ engine (max 256 MiB). Use the Node/Web engine for larger files. Streaming will be re-added with libsodium in v0.5.0 (ADR-0001).";
        return result;
    }

    // Load full plaintext.
    std::vector<BYTE> plaintext(static_cast<size_t>(fileSize.QuadPart));
    DWORD bytesRead = 0;
    if (fileSize.QuadPart > 0) {
        if (!ReadFile(hInput, plaintext.data(), static_cast<DWORD>(plaintext.size()), &bytesRead, NULL) || bytesRead != plaintext.size()) {
            CloseHandle(hInput);
            result.error = L"Failed to read input file";
            return result;
        }
    }
    CloseHandle(hInput);

    HANDLE hOutput = CreateFileW(outputPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOutput == INVALID_HANDLE_VALUE) {
        SecureZeroMemory(plaintext.data(), plaintext.size());
        result.error = L"Failed to create output file";
        return result;
    }

    try {
        // Single-shot AES-GCM via the (correct) AesGcmEncrypt primitive.
        std::vector<BYTE> iv;       // 16-byte random nonce — assigned inside AesGcmEncrypt
        std::vector<BYTE> authTag;  // 16-byte tag
        auto salt = GenerateRandomBytes(SALT_SIZE);

        auto ciphertext = AesGcmEncrypt(plaintext, key, iv, authTag);

        // Wipe plaintext from memory ASAP.
        SecureZeroMemory(plaintext.data(), plaintext.size());

        DWORD written = 0;
        // Header (v2): MAGIC | VERSION=2 | SALT | IV | TAG | CIPHERTEXT
        BYTE version = FILE_VERSION_V2;
        WriteFile(hOutput, FILE_MAGIC, sizeof(FILE_MAGIC), &written, NULL);
        WriteFile(hOutput, &version, 1, &written, NULL);
        WriteFile(hOutput, salt.data(), static_cast<DWORD>(salt.size()), &written, NULL);
        WriteFile(hOutput, iv.data(), static_cast<DWORD>(iv.size()), &written, NULL);
        WriteFile(hOutput, authTag.data(), static_cast<DWORD>(authTag.size()), &written, NULL);
        WriteFile(hOutput, ciphertext.data(), static_cast<DWORD>(ciphertext.size()), &written, NULL);

        result.success = true;
        result.outputPath = outputPath;
        result.hmac = authTag; // expose tag as integrity proof
    } catch (const std::exception& e) {
        SecureZeroMemory(plaintext.data(), plaintext.size());
        result.error = std::wstring(e.what(), e.what() + strlen(e.what()));
    }

    CloseHandle(hOutput);

    if (!result.success) {
        DeleteFileW(outputPath.c_str());
    }

    return result;
}

// CRIT-02 fix / ADR-0004: matches the single-shot EncryptFile above.
// Header v2 layout: MAGIC(6) | VERSION(1) | SALT(16) | IV(16) | TAG(16) | CIPHERTEXT(N).
// v1 files (broken streaming) are rejected with a clear error — they were unsafe
// anyway (nonce reuse, no real authentication).
FileEncryptionResult CryptoEngine::DecryptFile(const std::wstring& inputPath, const std::wstring& outputPath, const std::vector<BYTE>& key) {
    FileEncryptionResult result;
    result.success = false;

    HANDLE hInput = CreateFileW(inputPath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInput == INVALID_HANDLE_VALUE) {
        result.error = L"Failed to open input file";
        return result;
    }

    LARGE_INTEGER inputFileSize;
    GetFileSizeEx(hInput, &inputFileSize);

    constexpr size_t HEADER_SIZE = sizeof(FILE_MAGIC) + 1 + SALT_SIZE + GCM_IV_SIZE + GCM_TAG_SIZE;
    if (static_cast<ULONGLONG>(inputFileSize.QuadPart) < HEADER_SIZE) {
        CloseHandle(hInput);
        result.error = L"File too small to be a valid SecureCrypt v2 file";
        return result;
    }
    if (static_cast<ULONGLONG>(inputFileSize.QuadPart) > MAX_INMEM_ENCRYPT_BYTES + HEADER_SIZE) {
        CloseHandle(hInput);
        result.error = L"File too large for current C++ engine (max 256 MiB).";
        return result;
    }

    try {
        BYTE magic[sizeof(FILE_MAGIC)];
        BYTE version;
        DWORD bytesRead = 0;

        ReadFile(hInput, magic, sizeof(magic), &bytesRead, NULL);
        if (bytesRead != sizeof(magic) || memcmp(magic, FILE_MAGIC, sizeof(FILE_MAGIC)) != 0) {
            result.error = L"Invalid file format — not a SecureCrypt file";
            throw std::runtime_error("Invalid magic");
        }

        ReadFile(hInput, &version, 1, &bytesRead, NULL);
        if (version == FILE_VERSION) {
            // v1: the legacy broken format. Refuse to decrypt — the data was never
            // safely encrypted to begin with.
            result.error = L"File was encrypted with the broken v1 streaming format (pre-CRIT-02 fix) and cannot be decrypted safely. Restore from backup.";
            throw std::runtime_error("Legacy v1 format rejected");
        }
        if (version != FILE_VERSION_V2) {
            result.error = L"Unsupported file version";
            throw std::runtime_error("Invalid version");
        }

        std::vector<BYTE> salt(SALT_SIZE);
        std::vector<BYTE> iv(GCM_IV_SIZE);
        std::vector<BYTE> tag(GCM_TAG_SIZE);
        ReadFile(hInput, salt.data(), static_cast<DWORD>(salt.size()), &bytesRead, NULL);
        ReadFile(hInput, iv.data(), static_cast<DWORD>(iv.size()), &bytesRead, NULL);
        ReadFile(hInput, tag.data(), static_cast<DWORD>(tag.size()), &bytesRead, NULL);

        size_t ciphertextLen = static_cast<size_t>(inputFileSize.QuadPart) - HEADER_SIZE;
        std::vector<BYTE> ciphertext(ciphertextLen);
        if (ciphertextLen > 0) {
            if (!ReadFile(hInput, ciphertext.data(), static_cast<DWORD>(ciphertextLen), &bytesRead, NULL) || bytesRead != ciphertextLen) {
                result.error = L"Failed to read ciphertext";
                throw std::runtime_error("Read failed");
            }
        }
        CloseHandle(hInput);
        hInput = INVALID_HANDLE_VALUE;

        auto plaintext = AesGcmDecrypt(ciphertext, key, iv, tag);

        HANDLE hOutput = CreateFileW(outputPath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (hOutput == INVALID_HANDLE_VALUE) {
            SecureZeroMemory(plaintext.data(), plaintext.size());
            result.error = L"Failed to create output file";
            throw std::runtime_error("Output open failed");
        }

        DWORD written = 0;
        if (!plaintext.empty()) {
            WriteFile(hOutput, plaintext.data(), static_cast<DWORD>(plaintext.size()), &written, NULL);
        }
        CloseHandle(hOutput);

        SecureZeroMemory(plaintext.data(), plaintext.size());

        result.success = true;
        result.outputPath = outputPath;
        result.hmac = tag;
    } catch (const std::exception& e) {
        if (result.error.empty()) {
            result.error = std::wstring(e.what(), e.what() + strlen(e.what()));
        }
    }

    if (hInput != INVALID_HANDLE_VALUE) CloseHandle(hInput);

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
