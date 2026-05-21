#include "StringUtils.h"
#include <algorithm>
#include <cctype>
#include <cwchar>
#include <locale>
#include <codecvt>
#include <iomanip>
#include <sstream>

namespace securecrypt::utils {

std::wstring StringUtils::ToLower(const std::wstring& str) {
    std::wstring result = str;
    std::transform(result.begin(), result.end(), result.begin(), ::towlower);
    return result;
}

std::wstring StringUtils::ToUpper(const std::wstring& str) {
    std::wstring result = str;
    std::transform(result.begin(), result.end(), result.begin(), ::towupper);
    return result;
}

std::wstring StringUtils::Trim(const std::wstring& str) {
    return TrimLeft(TrimRight(str));
}

std::wstring StringUtils::TrimLeft(const std::wstring& str) {
    size_t start = str.find_first_not_of(L" \t\n\r\f\v");
    return (start == std::wstring::npos) ? L"" : str.substr(start);
}

std::wstring StringUtils::TrimRight(const std::wstring& str) {
    size_t end = str.find_last_not_of(L" \t\n\r\f\v");
    return (end == std::wstring::npos) ? L"" : str.substr(0, end + 1);
}

std::vector<std::wstring> StringUtils::Split(const std::wstring& str, wchar_t delimiter) {
    std::vector<std::wstring> tokens;
    std::wstringstream ss(str);
    std::wstring token;
    
    while (std::getline(ss, token, delimiter)) {
        tokens.push_back(token);
    }
    
    return tokens;
}

std::wstring StringUtils::Join(const std::vector<std::wstring>& parts, const std::wstring& separator) {
    std::wstring result;
    for (size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) result += separator;
        result += parts[i];
    }
    return result;
}

bool StringUtils::StartsWith(const std::wstring& str, const std::wstring& prefix) {
    if (prefix.length() > str.length()) return false;
    return str.compare(0, prefix.length(), prefix) == 0;
}

bool StringUtils::EndsWith(const std::wstring& str, const std::wstring& suffix) {
    if (suffix.length() > str.length()) return false;
    return str.compare(str.length() - suffix.length(), suffix.length(), suffix) == 0;
}

bool StringUtils::Contains(const std::wstring& str, const std::wstring& substring) {
    return str.find(substring) != std::wstring::npos;
}

std::wstring StringUtils::Replace(const std::wstring& str, const std::wstring& from, const std::wstring& to) {
    std::wstring result = str;
    size_t pos = 0;
    
    while ((pos = result.find(from, pos)) != std::wstring::npos) {
        result.replace(pos, from.length(), to);
        pos += to.length();
    }
    
    return result;
}

std::wstring StringUtils::ToWString(int value) {
    return std::to_wstring(value);
}

std::wstring StringUtils::ToWString(long long value) {
    return std::to_wstring(value);
}

std::wstring StringUtils::ToWString(double value, int precision) {
    std::wstringstream ss;
    ss << std::fixed << std::setprecision(precision) << value;
    return ss.str();
}

std::wstring StringUtils::FormatFileSize(ULONGLONG bytes) {
    const wchar_t* units[] = { L"B", L"KB", L"MB", L"GB", L"TB" };
    int unitIndex = 0;
    double size = static_cast<double>(bytes);
    
    while (size >= 1024.0 && unitIndex < 4) {
        size /= 1024.0;
        unitIndex++;
    }
    
    std::wstringstream ss;
    ss << std::fixed << std::setprecision(unitIndex == 0 ? 0 : 1) << size << L" " << units[unitIndex];
    return ss.str();
}

std::wstring StringUtils::MaskPassword(const std::wstring& password, wchar_t maskChar) {
    return std::wstring(password.length(), maskChar);
}

bool StringUtils::IsNullOrEmpty(const std::wstring& str) {
    return str.empty();
}

std::string StringUtils::WideToUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), static_cast<int>(wstr.size()), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), static_cast<int>(wstr.size()), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

std::wstring StringUtils::Utf8ToWide(const std::string& str) {
    if (str.empty()) return L"";
    
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), static_cast<int>(str.size()), NULL, 0);
    std::wstring wstrTo(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, str.c_str(), static_cast<int>(str.size()), &wstrTo[0], size_needed);
    return wstrTo;
}

}
