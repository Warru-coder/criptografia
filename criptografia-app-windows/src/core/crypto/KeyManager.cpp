#include "KeyManager.h"
#include "CryptoEngine.h"
#include "../utils/PathUtils.h"
#include <fstream>
#include <shlobj.h>

namespace securecrypt::crypto {

KeyManager& KeyManager::GetInstance() {
    static KeyManager instance;
    return instance;
}

KeyManager::KeyManager() : m_isInitialized(false), m_isLocked(true) {
    m_keyFilePath = securecrypt::utils::PathUtils::GetAppDataPath() + L"\\keys";
}

KeyManager::~KeyManager() {
    ClearKeys();
}

bool KeyManager::Initialize(const std::wstring& masterPassword) {
    std::lock_guard<std::mutex> lock(m_mutex);

    try {
        CreateSecureDirectory();

        CryptoEngine engine;
        auto salt = engine.GenerateRandomBytes(SALT_SIZE);
        m_encryptionKey = engine.DeriveKey(masterPassword, salt, AES_KEY_SIZE);
        m_authenticationKey = engine.GenerateRandomBytes(AES_KEY_SIZE);

        // SEC-005: generate a separate, dedicated salt for the password hash
        m_passwordSalt = engine.GenerateRandomBytes(SALT_SIZE);
        m_passwordHash = HashPasswordWithSalt(masterPassword, m_passwordSalt);

        std::vector<BYTE> protectedEncKey;
        if (!ProtectData(m_encryptionKey, protectedEncKey)) return false;

        std::vector<BYTE> protectedAuthKey;
        if (!ProtectData(m_authenticationKey, protectedAuthKey)) return false;

        // Write enc.key: saltSize + salt + encKeySize + encKey + authKeySize + authKey
        std::wstring keyFile = m_keyFilePath + L"\\enc.key";
        std::ofstream ofs(keyFile, std::ios::binary);
        if (!ofs) return false;

        DWORD saltSize = static_cast<DWORD>(salt.size());
        ofs.write(reinterpret_cast<const char*>(&saltSize), sizeof(saltSize));
        ofs.write(reinterpret_cast<const char*>(salt.data()), saltSize);

        DWORD encKeySize = static_cast<DWORD>(protectedEncKey.size());
        ofs.write(reinterpret_cast<const char*>(&encKeySize), sizeof(encKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedEncKey.data()), encKeySize);

        DWORD authKeySize = static_cast<DWORD>(protectedAuthKey.size());
        ofs.write(reinterpret_cast<const char*>(&authKeySize), sizeof(authKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedAuthKey.data()), authKeySize);
        ofs.close();

        SecureZeroMemory(salt.data(), salt.size());

        // SEC-005: write hash.dat as: pwdSaltSize + pwdSalt + hashSize + hash
        if (!SaveHashFile()) return false;

        m_isInitialized = true;
        m_isLocked = false;
        return true;
    } catch (...) {
        return false;
    }
}

bool KeyManager::IsInitialized() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_isInitialized;
}

std::vector<BYTE> KeyManager::GetEncryptionKey() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_isLocked || !m_isInitialized) {
        throw std::runtime_error("KeyManager is locked or not initialized");
    }
    return m_encryptionKey;
}

std::vector<BYTE> KeyManager::GetAuthenticationKey() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_isLocked || !m_isInitialized) {
        throw std::runtime_error("KeyManager is locked or not initialized");
    }
    return m_authenticationKey;
}

bool KeyManager::ChangeMasterPassword(const std::wstring& oldPassword, const std::wstring& newPassword) {
    std::lock_guard<std::mutex> lock(m_mutex);

    // SEC-005: use locked variant — we already hold m_mutex
    if (!VerifyMasterPasswordLocked(oldPassword)) {
        return false;
    }

    try {
        CryptoEngine engine;
        auto salt = engine.GenerateRandomBytes(SALT_SIZE);
        auto newEncryptionKey = engine.DeriveKey(newPassword, salt, AES_KEY_SIZE);
        auto newAuthKey = engine.GenerateRandomBytes(AES_KEY_SIZE);

        auto newPasswordSalt = engine.GenerateRandomBytes(SALT_SIZE);
        auto newPasswordHash = HashPasswordWithSalt(newPassword, newPasswordSalt);

        std::vector<BYTE> protectedEncKey;
        if (!ProtectData(newEncryptionKey, protectedEncKey)) {
            SecureZeroMemory(newEncryptionKey.data(), newEncryptionKey.size());
            return false;
        }

        std::vector<BYTE> protectedAuthKey;
        if (!ProtectData(newAuthKey, protectedAuthKey)) {
            SecureZeroMemory(newEncryptionKey.data(), newEncryptionKey.size());
            SecureZeroMemory(newAuthKey.data(), newAuthKey.size());
            return false;
        }

        std::wstring keyFile = m_keyFilePath + L"\\enc.key";
        std::ofstream ofs(keyFile, std::ios::binary | std::ios::trunc);
        if (!ofs) {
            SecureZeroMemory(newEncryptionKey.data(), newEncryptionKey.size());
            SecureZeroMemory(newAuthKey.data(), newAuthKey.size());
            return false;
        }

        DWORD saltSize = static_cast<DWORD>(salt.size());
        ofs.write(reinterpret_cast<const char*>(&saltSize), sizeof(saltSize));
        ofs.write(reinterpret_cast<const char*>(salt.data()), saltSize);

        DWORD encKeySize = static_cast<DWORD>(protectedEncKey.size());
        ofs.write(reinterpret_cast<const char*>(&encKeySize), sizeof(encKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedEncKey.data()), encKeySize);

        DWORD authKeySize = static_cast<DWORD>(protectedAuthKey.size());
        ofs.write(reinterpret_cast<const char*>(&authKeySize), sizeof(authKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedAuthKey.data()), authKeySize);
        ofs.close();

        m_encryptionKey = std::move(newEncryptionKey);
        m_authenticationKey = std::move(newAuthKey);
        m_passwordSalt = std::move(newPasswordSalt);
        m_passwordHash = std::move(newPasswordHash);

        SecureZeroMemory(salt.data(), salt.size());

        return SaveHashFile();
    } catch (...) {
        return false;
    }
}

// Public entry point — acquires the lock, then calls the locked variant
bool KeyManager::VerifyMasterPassword(const std::wstring& password) {
    std::lock_guard<std::mutex> lock(m_mutex);
    return VerifyMasterPasswordLocked(password);
}

bool KeyManager::Unlock(const std::wstring& password) {
    std::lock_guard<std::mutex> lock(m_mutex);

    // SEC-005: load the stored salt + hash from disk so verification works after restart
    if (!LoadHashFile()) return false;

    // SEC-005: use the locked variant — we already hold m_mutex
    if (!VerifyMasterPasswordLocked(password)) {
        return false;
    }

    try {
        std::wstring keyFile = m_keyFilePath + L"\\enc.key";
        std::ifstream ifs(keyFile, std::ios::binary);
        if (!ifs) return false;

        DWORD saltSize;
        ifs.read(reinterpret_cast<char*>(&saltSize), sizeof(saltSize));
        std::vector<BYTE> salt(saltSize);
        ifs.read(reinterpret_cast<char*>(salt.data()), saltSize);

        DWORD encKeySize;
        ifs.read(reinterpret_cast<char*>(&encKeySize), sizeof(encKeySize));
        std::vector<BYTE> protectedEncKey(encKeySize);
        ifs.read(reinterpret_cast<char*>(protectedEncKey.data()), encKeySize);

        DWORD authKeySize;
        ifs.read(reinterpret_cast<char*>(&authKeySize), sizeof(authKeySize));
        std::vector<BYTE> protectedAuthKey(authKeySize);
        ifs.read(reinterpret_cast<char*>(protectedAuthKey.data()), authKeySize);
        ifs.close();

        if (!UnprotectData(protectedEncKey, m_encryptionKey)) return false;

        if (!UnprotectData(protectedAuthKey, m_authenticationKey)) {
            SecureZeroMemory(m_encryptionKey.data(), m_encryptionKey.size());
            return false;
        }

        m_isInitialized = true;
        m_isLocked = false;
        return true;
    } catch (...) {
        return false;
    }
}

void KeyManager::Lock() {
    std::lock_guard<std::mutex> lock(m_mutex);
    ClearKeys();
    m_isLocked = true;
}

bool KeyManager::IsLocked() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_isLocked;
}

void KeyManager::ClearKeys() {
    if (!m_encryptionKey.empty()) {
        SecureZeroMemory(m_encryptionKey.data(), m_encryptionKey.size());
        m_encryptionKey.clear();
    }
    if (!m_authenticationKey.empty()) {
        SecureZeroMemory(m_authenticationKey.data(), m_authenticationKey.size());
        m_authenticationKey.clear();
    }
    if (!m_passwordHash.empty()) {
        SecureZeroMemory(m_passwordHash.data(), m_passwordHash.size());
        m_passwordHash.clear();
    }
    if (!m_passwordSalt.empty()) {
        SecureZeroMemory(m_passwordSalt.data(), m_passwordSalt.size());
        m_passwordSalt.clear();
    }
}

std::wstring KeyManager::GetKeyFilePath() const {
    return m_keyFilePath;
}

bool KeyManager::ProtectData(const std::vector<BYTE>& input, std::vector<BYTE>& output) {
    DATA_BLOB dataIn{ static_cast<DWORD>(input.size()), const_cast<BYTE*>(input.data()) };
    DATA_BLOB dataOut{};
    if (!CryptProtectData(&dataIn, NULL, NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &dataOut))
        return false;
    output.assign(dataOut.pbData, dataOut.pbData + dataOut.cbData);
    LocalFree(dataOut.pbData);
    return true;
}

bool KeyManager::UnprotectData(const std::vector<BYTE>& input, std::vector<BYTE>& output) {
    DATA_BLOB dataIn{ static_cast<DWORD>(input.size()), const_cast<BYTE*>(input.data()) };
    DATA_BLOB dataOut{};
    if (!CryptUnprotectData(&dataIn, NULL, NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &dataOut))
        return false;
    output.assign(dataOut.pbData, dataOut.pbData + dataOut.cbData);
    LocalFree(dataOut.pbData);
    return true;
}

// SEC-005: deterministic — same password + same salt always produces the same hash
std::vector<BYTE> KeyManager::HashPasswordWithSalt(const std::wstring& password, const std::vector<BYTE>& salt) {
    CryptoEngine engine;
    return engine.DeriveKey(password, salt, HASH_SIZE);
}

// SEC-003: XOR-fold all bytes before comparing — early-exit is impossible
bool KeyManager::ConstantTimeEqual(const std::vector<BYTE>& a, const std::vector<BYTE>& b) {
    if (a.size() != b.size()) return false;
    volatile BYTE diff = 0;
    for (size_t i = 0; i < a.size(); ++i) {
        diff |= (a[i] ^ b[i]);
    }
    return diff == 0;
}

// Internal — caller must hold m_mutex
bool KeyManager::VerifyMasterPasswordLocked(const std::wstring& password) {
    if (m_passwordSalt.empty() || m_passwordHash.empty()) return false;

    auto inputHash = HashPasswordWithSalt(password, m_passwordSalt);
    bool ok = ConstantTimeEqual(inputHash, m_passwordHash);
    SecureZeroMemory(inputHash.data(), inputHash.size());
    return ok;
}

bool KeyManager::LoadHashFile() {
    std::wstring hashFile = m_keyFilePath + L"\\hash.dat";
    std::ifstream ifs(hashFile, std::ios::binary);
    if (!ifs) return false;

    DWORD saltSize;
    ifs.read(reinterpret_cast<char*>(&saltSize), sizeof(saltSize));
    if (!ifs || saltSize == 0 || saltSize > 256) return false;
    m_passwordSalt.resize(saltSize);
    ifs.read(reinterpret_cast<char*>(m_passwordSalt.data()), saltSize);

    DWORD hashSize;
    ifs.read(reinterpret_cast<char*>(&hashSize), sizeof(hashSize));
    if (!ifs || hashSize == 0 || hashSize > 256) return false;
    m_passwordHash.resize(hashSize);
    ifs.read(reinterpret_cast<char*>(m_passwordHash.data()), hashSize);

    return ifs.good() || ifs.eof();
}

bool KeyManager::SaveHashFile() {
    std::wstring hashFile = m_keyFilePath + L"\\hash.dat";
    std::ofstream hofs(hashFile, std::ios::binary | std::ios::trunc);
    if (!hofs) return false;

    DWORD saltSize = static_cast<DWORD>(m_passwordSalt.size());
    hofs.write(reinterpret_cast<const char*>(&saltSize), sizeof(saltSize));
    hofs.write(reinterpret_cast<const char*>(m_passwordSalt.data()), saltSize);

    DWORD hashSize = static_cast<DWORD>(m_passwordHash.size());
    hofs.write(reinterpret_cast<const char*>(&hashSize), sizeof(hashSize));
    hofs.write(reinterpret_cast<const char*>(m_passwordHash.data()), hashSize);

    return hofs.good();
}

void KeyManager::CreateSecureDirectory() {
    CreateDirectoryW(m_keyFilePath.c_str(), NULL);

    SECURITY_DESCRIPTOR sd;
    InitializeSecurityDescriptor(&sd, SECURITY_DESCRIPTOR_REVISION);
    SetSecurityDescriptorDacl(&sd, TRUE, NULL, FALSE);

    SetFileSecurityW(m_keyFilePath.c_str(), DACL_SECURITY_INFORMATION, &sd);
}

}
