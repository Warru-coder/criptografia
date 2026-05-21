#include <windows.h>
#include <bcrypt.h>
#include <iostream>
#include <cassert>
#include <string>
#include <vector>
#include "../../src/core/crypto/CryptoEngine.h"
#include "../../src/core/crypto/PasswordGenerator.h"
#include "../../src/core/security/SecureMemory.h"

using namespace securecrypt::crypto;
using namespace securecrypt::security;

#define TEST(name) void name()
#define RUN_TEST(name) do { \
    std::wcout << L"  Running " << L#name << L"... "; \
    try { name(); std::wcout << L"PASSED" << std::endl; passed++; } \
    catch (const std::exception& e) { std::wcout << L"FAILED: " << e.what() << std::endl; failed++; } \
} while(0)

int passed = 0;
int failed = 0;

TEST(test_generate_random_bytes) {
    CryptoEngine engine;
    auto bytes1 = engine.GenerateRandomBytes(32);
    auto bytes2 = engine.GenerateRandomBytes(32);
    
    assert(bytes1.size() == 32);
    assert(bytes2.size() == 32);
    
    bool different = false;
    for (size_t i = 0; i < 32; ++i) {
        if (bytes1[i] != bytes2[i]) {
            different = true;
            break;
        }
    }
    assert(different);
}

TEST(test_aes_gcm_encrypt_decrypt) {
    CryptoEngine engine;
    
    auto key = engine.GenerateRandomBytes(AES_KEY_SIZE);
    std::vector<BYTE> plaintext = { 'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd' };
    
    auto encrypted = engine.EncryptData(plaintext, key);
    assert(!encrypted.ciphertext.empty());
    assert(encrypted.iv.size() == GCM_IV_SIZE);
    assert(encrypted.authTag.size() == GCM_TAG_SIZE);
    
    auto decrypted = engine.DecryptData(encrypted, key);
    assert(decrypted == plaintext);
}

TEST(test_derive_key_deterministic) {
    CryptoEngine engine;
    
    std::wstring password = L"TestPassword123!";
    std::vector<BYTE> salt = { 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                               0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10 };
    
    auto key1 = engine.DeriveKey(password, salt);
    auto key2 = engine.DeriveKey(password, salt);
    
    assert(key1.size() == AES_KEY_SIZE);
    assert(key1 == key2);
}

TEST(test_derive_key_different_salts) {
    CryptoEngine engine;
    
    std::wstring password = L"TestPassword123!";
    auto salt1 = engine.GenerateRandomBytes(SALT_SIZE);
    auto salt2 = engine.GenerateRandomBytes(SALT_SIZE);
    
    auto key1 = engine.DeriveKey(password, salt1);
    auto key2 = engine.DeriveKey(password, salt2);
    
    assert(key1 != key2);
}

TEST(test_compute_hash) {
    CryptoEngine engine;
    
    std::vector<BYTE> data = { 't', 'e', 's', 't' };
    auto hash1 = engine.ComputeHash(data);
    auto hash2 = engine.ComputeHash(data);
    
    assert(hash1.size() == HASH_SIZE);
    assert(hash1 == hash2);
    
    std::vector<BYTE> data2 = { 't', 'e', 's', 't', '2' };
    auto hash3 = engine.ComputeHash(data2);
    assert(hash1 != hash3);
}

TEST(test_hmac_compute_and_verify) {
    CryptoEngine engine;
    
    auto key = engine.GenerateRandomBytes(AES_KEY_SIZE);
    std::vector<BYTE> data = { 'd', 'a', 't', 'a' };
    
    auto hmac = engine.ComputeHMAC(data, key);
    assert(hmac.size() == HASH_SIZE);
    
    assert(engine.VerifyHMAC(data, key, hmac));
    
    std::vector<BYTE> tamperedData = { 'd', 'a', 't', 'a', '!' };
    assert(!engine.VerifyHMAC(tamperedData, key, hmac));
}

TEST(test_password_generator_length) {
    auto password = PasswordGenerator::Generate(24);
    assert(password.length() == 24);
    
    auto password16 = PasswordGenerator::Generate(16);
    assert(password16.length() == 16);
}

TEST(test_password_generator_complexity) {
    auto password = PasswordGenerator::Generate(24, true, true, true, true);
    
    bool hasUpper = false, hasLower = false, hasDigit = false, hasSymbol = false;
    for (wchar_t c : password) {
        if (iswupper(c)) hasUpper = true;
        if (iswlower(c)) hasLower = true;
        if (iswdigit(c)) hasDigit = true;
        if (!iswalnum(c)) hasSymbol = true;
    }
    
    assert(hasUpper);
    assert(hasLower);
    assert(hasDigit);
    assert(hasSymbol);
}

TEST(test_password_generator_unique) {
    auto p1 = PasswordGenerator::Generate(24);
    auto p2 = PasswordGenerator::Generate(24);
    assert(p1 != p2);
}

TEST(test_password_generator_min_length) {
    bool threw = false;
    try {
        PasswordGenerator::Generate(8);
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    assert(threw);
}

TEST(test_password_validation_weak) {
    auto result = PasswordGenerator::Validate(L"weak");
    assert(result.strength == PasswordStrength::VeryWeak);
    assert(!result.issues.empty());
}

TEST(test_password_validation_strong) {
    auto result = PasswordGenerator::Validate(L"Str0ng!P@ssw0rd#2024");
    assert(result.score >= 4);
    assert(result.strength == PasswordStrength::Strong || result.strength == PasswordStrength::VeryStrong);
}

TEST(test_password_validation_common) {
    auto result = PasswordGenerator::Validate(L"password123");
    assert(result.strength == PasswordStrength::VeryWeak);
}

TEST(test_secure_clear_buffer) {
    std::vector<BYTE> buffer = { 0x01, 0x02, 0x03, 0x04, 0x05 };
    SecureMemory::SecureClearVector(buffer);
    
    assert(buffer.empty());
}

TEST(test_secure_clear_string) {
    std::wstring str = L"secret";
    SecureMemory::SecureClearString(str);
    
    assert(str.empty());
}

TEST(test_secure_buffer) {
    SecureMemory::SecureBuffer buffer(1024);
    assert(buffer.data() != nullptr);
    assert(buffer.size() == 1024);
    
    memset(buffer.data(), 0xAB, buffer.size());
}

int main(int argc, char* argv[]) {
    std::wcout << L"========================================" << std::endl;
    std::wcout << L"  SecureCrypt Unit Tests" << std::endl;
    std::wcout << L"========================================" << std::endl;
    std::wcout << std::endl;
    
    std::wcout << L"Crypto Tests:" << std::endl;
    RUN_TEST(test_generate_random_bytes);
    RUN_TEST(test_aes_gcm_encrypt_decrypt);
    RUN_TEST(test_derive_key_deterministic);
    RUN_TEST(test_derive_key_different_salts);
    RUN_TEST(test_compute_hash);
    RUN_TEST(test_hmac_compute_and_verify);
    
    std::wcout << std::endl << L"Password Tests:" << std::endl;
    RUN_TEST(test_password_generator_length);
    RUN_TEST(test_password_generator_complexity);
    RUN_TEST(test_password_generator_unique);
    RUN_TEST(test_password_generator_min_length);
    RUN_TEST(test_password_validation_weak);
    RUN_TEST(test_password_validation_strong);
    RUN_TEST(test_password_validation_common);
    
    std::wcout << std::endl << L"Memory Tests:" << std::endl;
    RUN_TEST(test_secure_clear_buffer);
    RUN_TEST(test_secure_clear_string);
    RUN_TEST(test_secure_buffer);
    
    std::wcout << std::endl;
    std::wcout << L"========================================" << std::endl;
    std::wcout << L"  Results: " << passed << L" passed, " << failed << L" failed" << std::endl;
    std::wcout << L"========================================" << std::endl;
    
    return failed > 0 ? 1 : 0;
}
