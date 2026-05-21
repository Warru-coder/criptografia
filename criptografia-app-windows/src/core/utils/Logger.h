#pragma once

#include <windows.h>
#include <string>
#include <mutex>
#include <fstream>

namespace securecrypt::utils {

enum class LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical
};

class Logger {
public:
    static Logger& GetInstance();
    
    void Log(LogLevel level, const std::wstring& message, const std::wstring& source = L"");
    
    void Debug(const std::wstring& message, const std::wstring& source = L"");
    void Info(const std::wstring& message, const std::wstring& source = L"");
    void Warning(const std::wstring& message, const std::wstring& source = L"");
    void Error(const std::wstring& message, const std::wstring& source = L"");
    void Critical(const std::wstring& message, const std::wstring& source = L"");
    
    bool Initialize(const std::wstring& logFilePath);
    
    void SetMinLevel(LogLevel level);
    
    void Flush();

private:
    Logger();
    ~Logger();
    
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    
    std::mutex m_mutex;
    std::wofstream m_logFile;
    LogLevel m_minLevel;
    std::wstring m_logFilePath;
    
    std::wstring LevelToString(LogLevel level);
    std::wstring GetTimestamp();
};

}
