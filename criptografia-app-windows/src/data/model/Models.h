#pragma once

#include <windows.h>
#include <string>
#include <vector>

namespace securecrypt::data {

struct PasswordEntry {
    int id;
    std::wstring title;
    std::vector<BYTE> encryptedUsername;
    std::vector<BYTE> encryptedPassword;
    std::vector<BYTE> encryptedUrl;
    std::vector<BYTE> encryptedNotes;
    std::wstring category;
    std::vector<BYTE> iv;
    FILETIME createdAt;
    FILETIME updatedAt;
    FILETIME lastAccessed;
    int accessCount;
    bool isFavorite;
    std::wstring tags;
};

struct DocumentEntry {
    int id;
    std::wstring title;
    std::wstring originalFileName;
    std::wstring encryptedFilePath;
    std::wstring mimeType;
    ULONGLONG fileSize;
    std::vector<BYTE> iv;
    std::vector<BYTE> hmac;
    FILETIME createdAt;
    FILETIME lastAccessed;
    int accessCount;
    bool isFavorite;
    std::wstring tags;
    std::wstring thumbnailPath;
};

struct NoteEntry {
    int id;
    std::wstring title;
    std::vector<BYTE> encryptedContent;
    std::vector<BYTE> iv;
    FILETIME createdAt;
    FILETIME updatedAt;
    bool isFavorite;
    std::wstring tags;
};

struct DecryptedPassword {
    int id;
    std::wstring title;
    std::wstring username;
    std::wstring password;
    std::wstring url;
    std::wstring notes;
    std::wstring category;
    FILETIME createdAt;
    FILETIME updatedAt;
    FILETIME lastAccessed;
    int accessCount;
    bool isFavorite;
    std::wstring tags;
};

struct DecryptedNote {
    int id;
    std::wstring title;
    std::wstring content;
    FILETIME createdAt;
    FILETIME updatedAt;
    bool isFavorite;
    std::wstring tags;
};

}
