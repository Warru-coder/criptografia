#pragma once

#include <windows.h>
#include <string>
#include <vector>

namespace securecrypt::utils {

class PathUtils {
public:
    static std::wstring GetAppDataPath();
    
    static std::wstring GetExecutablePath();
    
    static std::wstring GetExecutableDirectory();
    
    static std::wstring GetDocumentsPath();
    
    static std::wstring GetTempPath();
    
    static std::wstring Combine(const std::wstring& path1, const std::wstring& path2);
    
    static std::wstring GetFileName(const std::wstring& filePath);
    
    static std::wstring GetFileNameWithoutExtension(const std::wstring& filePath);
    
    static std::wstring GetExtension(const std::wstring& filePath);
    
    static std::wstring GetDirectory(const std::wstring& filePath);
    
    static bool FileExists(const std::wstring& filePath);
    
    static bool DirectoryExists(const std::wstring& dirPath);
    
    static bool CreateDirectory(const std::wstring& dirPath);
    
    static bool CreateDirectories(const std::wstring& dirPath);
    
    static bool DeleteFile(const std::wstring& filePath);
    
    static bool SecureDeleteFile(const std::wstring& filePath, int passes = 3);
    
    static ULONGLONG GetFileSize(const std::wstring& filePath);
    
    static std::vector<std::wstring> ListFiles(const std::wstring& directory, const std::wstring& filter = L"*.*");
    
    static std::wstring GetMimeType(const std::wstring& filePath);

private:
    static void SecureOverwriteFile(const std::wstring& filePath);
};

}
