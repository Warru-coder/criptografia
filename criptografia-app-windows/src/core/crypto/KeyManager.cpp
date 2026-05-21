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
        m_passwordHash = HashPassword(masterPassword);
        
        std::vector<BYTE> protectedEncryptionKey;
        if (!ProtectData(m_encryptionKey, protectedEncryptionKey)) {
            return false;
        }
        
        std::vector<BYTE> protectedAuthKey;
        if (!ProtectData(m_authenticationKey, protectedAuthKey)) {
            return false;
        }
        
        std::wstring keyFile = m_keyFilePath + L"\\enc.key";
        std::ofstream ofs(keyFile, std::ios::binary);
        if (!ofs) return false;
        
        DWORD saltSize = static_cast<DWORD>(salt.size());
        ofs.write(reinterpret_cast<const char*>(&saltSize), sizeof(saltSize));
        ofs.write(reinterpret_cast<const char*>(salt.data()), saltSize);
        
        DWORD encKeySize = static_cast<DWORD>(protectedEncryptionKey.size());
        ofs.write(reinterpret_cast<const char*>(&encKeySize), sizeof(encKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedEncryptionKey.data()), encKeySize);
        
        DWORD authKeySize = static_cast<DWORD>(protectedAuthKey.size());
        ofs.write(reinterpret_cast<const char*>(&authKeySize), sizeof(authKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedAuthKey.data()), authKeySize);
        
        ofs.close();
        
        DWORD hashSize = static_cast<DWORD>(m_passwordHash.size());
        std::wstring hashFile = m_keyFilePath + L"\\hash.dat";
        std::ofstream hofs(hashFile, std::ios::binary);
        if (!hofs) return false;
        hofs.write(reinterpret_cast<const char*>(&hashSize), sizeof(hashSize));
        hofs.write(reinterpret_cast<const char*>(m_passwordHash.data()), hashSize);
        hofs.close();
        
        SecureZeroMemory(salt.data(), salt.size());
        
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
    
    if (!VerifyMasterPassword(oldPassword)) {
        return false;
    }
    
    try {
        CryptoEngine engine;
        auto salt = engine.GenerateRandomBytes(SALT_SIZE);
        auto newEncryptionKey = engine.DeriveKey(newPassword, salt, AES_KEY_SIZE);
        auto newAuthKey = engine.GenerateRandomBytes(AES_KEY_SIZE);
        auto newPasswordHash = HashPassword(newPassword);
        
        std::vector<BYTE> protectedEncryptionKey;
        if (!ProtectData(newEncryptionKey, protectedEncryptionKey)) {
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
        
        DWORD encKeySize = static_cast<DWORD>(protectedEncryptionKey.size());
        ofs.write(reinterpret_cast<const char*>(&encKeySize), sizeof(encKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedEncryptionKey.data()), encKeySize);
        
        DWORD authKeySize = static_cast<DWORD>(protectedAuthKey.size());
        ofs.write(reinterpret_cast<const char*>(&authKeySize), sizeof(authKeySize));
        ofs.write(reinterpret_cast<const char*>(protectedAuthKey.data()), authKeySize);
        
        ofs.close();
        
        m_encryptionKey = std::move(newEncryptionKey);
        m_authenticationKey = std::move(newAuthKey);
        m_passwordHash = std::move(newPasswordHash);
        
        DWORD hashSize = static_cast<DWORD>(m_passwordHash.size());
        std::wstring hashFile = m_keyFilePath + L"\\hash.dat";
        std::ofstream hofs(hashFile, std::ios::binary | std::ios::trunc);
        hofs.write(reinterpret_cast<const char*>(&hashSize), sizeof(hashSize));
        hofs.write(reinterpret_cast<const char*>(m_passwordHash.data()), hashSize);
        hofs.close();
        
        SecureZeroMemory(salt.data(), salt.size());
        
        return true;
    } catch (...) {
        return false;
    }
}

bool KeyManager::VerifyMasterPassword(const std::wstring& password) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    auto inputHash = HashPassword(password);
    bool matches = (inputHash == m_passwordHash);
    
    SecureZeroMemory(inputHash.data(), inputHash.size());
    return matches;
}

bool KeyManager::Unlock(const std::wstring& password) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    if (!VerifyMasterPassword(password)) {
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
        
        if (!UnprotectData(protectedEncKey, m_encryptionKey)) {
            return false;
        }
        
        if (!UnprotectData(protectedAuthKey, m_authenticationKey)) {
            SecureZeroMemory(m_encryptionKey.data(), m_encryptionKey.size());
            return false;
        }
        
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
}

std::wstring KeyManager::GetKeyFilePath() const {
    return m_keyFilePath;
}

bool KeyManager::ProtectData(const std::vector<BYTE>& input, std::vector<BYTE>& output) {
    DATA_BLOB dataIn;
    DATA_BLOB dataOut;
    
    dataIn.pbData = const_cast<BYTE*>(input.data());
    dataIn.cbData = static_cast<DWORD>(input.size());
    
    if (!CryptProtectData(&dataIn, NULL, NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &dataOut)) {
        return false;
    }
    
    output.assign(dataOut.pbData, dataOut.pbData + dataOut.cbData);
    LocalFree(dataOut.pbData);
    return true;
}

bool KeyManager::UnprotectData(const std::vector<BYTE>& input, std::vector<BYTE>& output) {
    DATA_BLOB dataIn;
    DATA_BLOB dataOut;
    
    dataIn.pbData = const_cast<BYTE*>(input.data());
    dataIn.cbData = static_cast<DWORD>(input.size());
    
    if (!CryptUnprotectData(&dataIn, NULL, NULL, NULL, NULL, CRYPTPROTECT_UI_FORBIDDEN, &dataOut)) {
        return false;
    }
    
    output.assign(dataOut.pbData, dataOut.pbData + dataOut.cbData);
    LocalFree(dataOut.pbData);
    return true;
}

std::vector<BYTE> KeyManager::HashPassword(const std::wstring& password) {
    CryptoEngine engine;
    auto salt = engine.GenerateRandomBytes(SALT_SIZE);
    auto hash = engine.DeriveKey(password, salt, HASH_SIZE);
    SecureZeroMemory(salt.data(), salt.size());
    return hash;
}

void KeyManager::CreateSecureDirectory() {
    CreateDirectoryW(m_keyFilePath.c_str(), NULL);
    
    SECURITY_ATTRIBUTES sa;
    SECURITY_DESCRIPTOR sd;
    InitializeSecurityDescriptor(&sd, SECURITY_DESCRIPTOR_REVISION);
    SetSecurityDescriptorDacl(&sd, TRUE, NULL, FALSE);
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.lpSecurityDescriptor = &sd;
    sa.bInheritHandle = FALSE;
    
    SetFileSecurityW(m_keyFilePath.c_str(), DACL_SECURITY_INFORMATION, &sd);
}

}
