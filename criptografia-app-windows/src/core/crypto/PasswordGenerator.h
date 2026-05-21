#pragma once

#include <string>
#include <vector>

namespace securecrypt::crypto {

enum class PasswordStrength {
    VeryWeak,
    Weak,
    Medium,
    Strong,
    VeryStrong
};

struct PasswordValidationResult {
    PasswordStrength strength;
    int score;
    std::vector<std::wstring> issues;
};

class PasswordGenerator {
public:
    static std::wstring Generate(size_t length = 24,
                                 bool includeUppercase = true,
                                 bool includeLowercase = true,
                                 bool includeNumbers = true,
                                 bool includeSymbols = true);
    
    static PasswordValidationResult Validate(const std::wstring& password);
    
    static std::wstring GetStrengthLabel(PasswordStrength strength);
    
    static bool IsCommonPassword(const std::wstring& password);

private:
    static const std::vector<std::wstring> COMMON_PASSWORDS;
};

}
