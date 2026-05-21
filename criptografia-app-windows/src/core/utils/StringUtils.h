#pragma once

#include <string>
#include <vector>
#include <sstream>

namespace securecrypt::utils {

class StringUtils {
public:
    static std::wstring ToLower(const std::wstring& str);
    
    static std::wstring ToUpper(const std::wstring& str);
    
    static std::wstring Trim(const std::wstring& str);
    
    static std::wstring TrimLeft(const std::wstring& str);
    
    static std::wstring TrimRight(const std::wstring& str);
    
    static std::vector<std::wstring> Split(const std::wstring& str, wchar_t delimiter);
    
    static std::wstring Join(const std::vector<std::wstring>& parts, const std::wstring& separator);
    
    static bool StartsWith(const std::wstring& str, const std::wstring& prefix);
    
    static bool EndsWith(const std::wstring& str, const std::wstring& suffix);
    
    static bool Contains(const std::wstring& str, const std::wstring& substring);
    
    static std::wstring Replace(const std::wstring& str, const std::wstring& from, const std::wstring& to);
    
    static std::wstring Format(const std::wstring& format, ...);
    
    static std::wstring ToWString(int value);
    
    static std::wstring ToWString(long long value);
    
    static std::wstring ToWString(double value, int precision = 2);
    
    static std::wstring FormatFileSize(ULONGLONG bytes);
    
    static std::wstring MaskPassword(const std::wstring& password, wchar_t maskChar = L'*');
    
    static bool IsNullOrEmpty(const std::wstring& str);
    
    static std::string WideToUtf8(const std::wstring& wstr);
    
    static std::wstring Utf8ToWide(const std::string& str);
};

}
