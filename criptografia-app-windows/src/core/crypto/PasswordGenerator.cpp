#include "PasswordGenerator.h"
#include <bcrypt.h>
#include <algorithm>

namespace securecrypt::crypto {

const std::vector<std::wstring> PasswordGenerator::COMMON_PASSWORDS = {
    L"password", L"123456", L"12345678", L"qwerty", L"abc123", L"monkey", L"1234567",
    L"letmein", L"trustno1", L"dragon", L"baseball", L"iloveyou", L"master", L"sunshine",
    L"ashley", L"bailey", L"shadow", L"123123", L"654321", L"superman", L"qazwsq",
    L"michael", L"football", L"password1", L"password123", L"welcome", L"admin",
    L"login", L"princess", L"starwars", L"hello", L"charlie", L"donald", L"admin123"
};

std::wstring PasswordGenerator::Generate(size_t length, bool includeUppercase, bool includeLowercase, bool includeNumbers, bool includeSymbols) {
    if (length < 12) {
        throw std::invalid_argument("Password length must be at least 12 characters");
    }
    
    std::wstring charset;
    if (includeUppercase) charset += L"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeLowercase) charset += L"abcdefghijklmnopqrstuvwxyz";
    if (includeNumbers) charset += L"0123456789";
    if (includeSymbols) charset += L"!@#$%^&*()_+-=[]{}|;:,.<>?";
    
    if (charset.empty()) {
        throw std::invalid_argument("At least one character set must be included");
    }
    
    std::wstring password(length, L'\0');
    
    std::vector<BYTE> randomBytes(length * sizeof(DWORD));
    BCryptGenRandom(NULL, randomBytes.data(), static_cast<ULONG>(randomBytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG);
    
    for (size_t i = 0; i < length; ++i) {
        DWORD randomValue;
        memcpy(&randomValue, &randomBytes[i * sizeof(DWORD)], sizeof(DWORD));
        password[i] = charset[randomValue % charset.length()];
    }
    
    SecureZeroMemory(randomBytes.data(), randomBytes.size());
    
    return password;
}

PasswordValidationResult PasswordGenerator::Validate(const std::wstring& password) {
    PasswordValidationResult result;
    result.score = 0;
    
    if (password.length() < 12) {
        result.issues.push_back(L"Password must be at least 12 characters");
    } else if (password.length() >= 16) {
        result.score += 2;
    } else {
        result.score += 1;
    }
    
    bool hasUpper = false, hasLower = false, hasDigit = false, hasSymbol = false;
    for (wchar_t c : password) {
        if (iswupper(c)) hasUpper = true;
        if (iswlower(c)) hasLower = true;
        if (iswdigit(c)) hasDigit = true;
        if (!iswalnum(c)) hasSymbol = true;
    }
    
    if (hasUpper) result.score++;
    else result.issues.push_back(L"Add uppercase letters");
    
    if (hasLower) result.score++;
    else result.issues.push_back(L"Add lowercase letters");
    
    if (hasDigit) result.score++;
    else result.issues.push_back(L"Add numbers");
    
    if (hasSymbol) result.score++;
    else result.issues.push_back(L"Add special characters");
    
    if (IsCommonPassword(password)) {
        result.issues.push_back(L"Contains common password pattern");
        result.score = 0;
    }
    
    if (password.length() >= 4) {
        for (size_t i = 0; i <= password.length() - 4; ++i) {
            bool allSame = true;
            for (size_t j = 1; j < 4; ++j) {
                if (password[i + j] != password[i]) {
                    allSame = false;
                    break;
                }
            }
            if (allSame) {
                result.issues.push_back(L"Contains repeated characters");
                result.score = max(0, result.score - 1);
                break;
            }
        }
    }
    
    if (result.score >= 5) result.strength = PasswordStrength::VeryStrong;
    else if (result.score >= 4) result.strength = PasswordStrength::Strong;
    else if (result.score >= 3) result.strength = PasswordStrength::Medium;
    else if (result.score >= 2) result.strength = PasswordStrength::Weak;
    else result.strength = PasswordStrength::VeryWeak;
    
    return result;
}

std::wstring PasswordGenerator::GetStrengthLabel(PasswordStrength strength) {
    switch (strength) {
        case PasswordStrength::VeryStrong: return L"Very Strong";
        case PasswordStrength::Strong: return L"Strong";
        case PasswordStrength::Medium: return L"Medium";
        case PasswordStrength::Weak: return L"Weak";
        case PasswordStrength::VeryWeak: return L"Very Weak";
        default: return L"Unknown";
    }
}

bool PasswordGenerator::IsCommonPassword(const std::wstring& password) {
    std::wstring lower = password;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::towlower);
    
    for (const auto& common : COMMON_PASSWORDS) {
        if (lower == common) return true;
    }
    
    return false;
}

}
