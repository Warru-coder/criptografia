#pragma once

#include <windows.h>
#include <string>
#include <functional>

namespace securecrypt::crypto {

class FileCipher {
public:
    struct ProgressInfo {
        ULONGLONG bytesProcessed;
        ULONGLONG totalBytes;
        double percentage;
    };
    
    using ProgressCallback = std::function<void(const ProgressInfo&)>;
    
    static bool EncryptFile(const std::wstring& inputPath, const std::wstring& outputPath, 
                           const std::vector<BYTE>& key, ProgressCallback callback = nullptr);
    
    static bool DecryptFile(const std::wstring& inputPath, const std::wstring& outputPath, 
                           const std::vector<BYTE>& key, ProgressCallback callback = nullptr);
    
    static bool VerifyFileIntegrity(const std::wstring& filePath, const std::vector<BYTE>& key);
    
    static std::wstring GetFileExtension(const std::wstring& filePath);
    
    static bool IsSecureCryptFile(const std::wstring& filePath);
    
    static ULONGLONG GetOriginalFileSize(const std::wstring& encryptedPath);

private:
    static constexpr BYTE FILE_MAGIC[] = { 0x53, 0x43, 0x52, 0x59, 0x50, 0x54 };
    static constexpr BYTE FILE_VERSION = 0x01;
    static constexpr size_t BUFFER_SIZE = 1048576;
    static constexpr size_t GCM_IV_SIZE = 16;
    static constexpr size_t GCM_TAG_SIZE = 16;
    static constexpr size_t SALT_SIZE = 16;
};

}
