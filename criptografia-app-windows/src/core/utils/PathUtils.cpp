#include "PathUtils.h"
#include <shlobj.h>
#include <fstream>
#include <algorithm>

namespace securecrypt::utils {

std::wstring PathUtils::GetAppDataPath() {
    wchar_t path[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, path))) {
        return std::wstring(path) + L"\\SecureCrypt\\";
    }
    return GetExecutableDirectory() + L"\\data\\";
}

std::wstring PathUtils::GetExecutablePath() {
    wchar_t path[MAX_PATH];
    GetModuleFileNameW(NULL, path, MAX_PATH);
    return std::wstring(path);
}

std::wstring PathUtils::GetExecutableDirectory() {
    std::wstring exePath = GetExecutablePath();
    size_t pos = exePath.find_last_of(L"\\/");
    return (pos != std::wstring::npos) ? exePath.substr(0, pos) : L"";
}

std::wstring PathUtils::GetDocumentsPath() {
    wchar_t path[MAX_PATH];
    if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_MYDOCUMENTS, NULL, 0, path))) {
        return std::wstring(path);
    }
    return L"";
}

std::wstring PathUtils::GetTempPath() {
    wchar_t path[MAX_PATH];
    ::GetTempPathW(MAX_PATH, path);
    return std::wstring(path);
}

std::wstring PathUtils::Combine(const std::wstring& path1, const std::wstring& path2) {
    if (path1.empty()) return path2;
    if (path2.empty()) return path1;
    
    if (path2[0] == L'\\' || path2[1] == L':') return path2;
    
    std::wstring result = path1;
    if (result.back() != L'\\') result += L'\\';
    result += path2;
    
    return result;
}

std::wstring PathUtils::GetFileName(const std::wstring& filePath) {
    size_t pos = filePath.find_last_of(L"\\/");
    return (pos != std::wstring::npos) ? filePath.substr(pos + 1) : filePath;
}

std::wstring PathUtils::GetFileNameWithoutExtension(const std::wstring& filePath) {
    std::wstring fileName = GetFileName(filePath);
    size_t pos = fileName.find_last_of(L'.');
    return (pos != std::wstring::npos) ? fileName.substr(0, pos) : fileName;
}

std::wstring PathUtils::GetExtension(const std::wstring& filePath) {
    std::wstring fileName = GetFileName(filePath);
    size_t pos = fileName.find_last_of(L'.');
    return (pos != std::wstring::npos) ? fileName.substr(pos) : L"";
}

std::wstring PathUtils::GetDirectory(const std::wstring& filePath) {
    size_t pos = filePath.find_last_of(L"\\/");
    return (pos != std::wstring::npos) ? filePath.substr(0, pos) : L"";
}

bool PathUtils::FileExists(const std::wstring& filePath) {
    DWORD attr = GetFileAttributesW(filePath.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
}

bool PathUtils::DirectoryExists(const std::wstring& dirPath) {
    DWORD attr = GetFileAttributesW(dirPath.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY));
}

bool PathUtils::CreateDirectory(const std::wstring& dirPath) {
    return ::CreateDirectoryW(dirPath.c_str(), NULL) != FALSE;
}

bool PathUtils::CreateDirectories(const std::wstring& dirPath) {
    if (DirectoryExists(dirPath)) return true;
    
    std::wstring path = dirPath;
    for (size_t i = 1; i < path.length(); ++i) {
        if (path[i] == L'\\') {
            path[i] = L'\0';
            if (!DirectoryExists(path)) {
                if (!::CreateDirectoryW(path.c_str(), NULL)) {
                    if (GetLastError() != ERROR_ALREADY_EXISTS) {
                        return false;
                    }
                }
            }
            path[i] = L'\\';
        }
    }
    return ::CreateDirectoryW(path.c_str(), NULL) != FALSE || GetLastError() == ERROR_ALREADY_EXISTS;
}

bool PathUtils::DeleteFile(const std::wstring& filePath) {
    return ::DeleteFileW(filePath.c_str()) != FALSE;
}

bool PathUtils::SecureDeleteFile(const std::wstring& filePath, int passes) {
    if (!FileExists(filePath)) return false;
    
    for (int i = 0; i < passes; ++i) {
        SecureOverwriteFile(filePath);
    }
    
    return ::DeleteFileW(filePath.c_str()) != FALSE;
}

ULONGLONG PathUtils::GetFileSize(const std::wstring& filePath) {
    WIN32_FILE_ATTRIBUTE_DATA fileInfo;
    if (!GetFileAttributesExW(filePath.c_str(), GetFileExInfoStandard, &fileInfo)) {
        return 0;
    }
    return ((ULONGLONG)fileInfo.nFileSizeHigh << 32) | fileInfo.nFileSizeLow;
}

std::vector<std::wstring> PathUtils::ListFiles(const std::wstring& directory, const std::wstring& filter) {
    std::vector<std::wstring> files;
    
    std::wstring searchPath = Combine(directory, filter);
    WIN32_FIND_DATAW findData;
    
    HANDLE hFind = FindFirstFileW(searchPath.c_str(), &findData);
    if (hFind == INVALID_HANDLE_VALUE) return files;
    
    do {
        if (!(findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) {
            files.push_back(Combine(directory, findData.cFileName));
        }
    } while (FindNextFileW(hFind, &findData));
    
    FindClose(hFind);
    return files;
}

std::wstring PathUtils::GetMimeType(const std::wstring& filePath) {
    std::wstring ext = GetExtension(filePath);
    
    if (ext == L".pdf") return L"application/pdf";
    if (ext == L".doc" || ext == L".docx") return L"application/msword";
    if (ext == L".xls" || ext == L".xlsx") return L"application/vnd.ms-excel";
    if (ext == L".jpg" || ext == L".jpeg") return L"image/jpeg";
    if (ext == L".png") return L"image/png";
    if (ext == L".gif") return L"image/gif";
    if (ext == L".txt") return L"text/plain";
    if (ext == L".zip") return L"application/zip";
    if (ext == L".rar") return L"application/x-rar-compressed";
    
    return L"application/octet-stream";
}

void PathUtils::SecureOverwriteFile(const std::wstring& filePath) {
    ULONGLONG size = GetFileSize(filePath);
    if (size == 0) return;
    
    HANDLE hFile = CreateFileW(filePath.c_str(), GENERIC_WRITE, 0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hFile == INVALID_HANDLE_VALUE) return;
    
    const DWORD bufferSize = 65536;
    std::vector<BYTE> buffer(bufferSize, 0x00);
    
    ULONGLONG remaining = size;
    while (remaining > 0) {
        DWORD toWrite = static_cast<DWORD>(min(remaining, bufferSize));
        DWORD written;
        WriteFile(hFile, buffer.data(), toWrite, &written, NULL);
        remaining -= toWrite;
    }
    
    FlushFileBuffers(hFile);
    SetFilePointer(hFile, 0, NULL, FILE_BEGIN);
    SetEndOfFile(hFile);
    
    CloseHandle(hFile);
}

}
