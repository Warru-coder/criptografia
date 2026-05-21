#include "Logger.h"
#include <iostream>
#include <iomanip>
#include <sstream>
#include <chrono>

namespace securecrypt::utils {

Logger& Logger::GetInstance() {
    static Logger instance;
    return instance;
}

Logger::Logger() : m_minLevel(LogLevel::Info) {
}

Logger::~Logger() {
    Flush();
    if (m_logFile.is_open()) {
        m_logFile.close();
    }
}

bool Logger::Initialize(const std::wstring& logFilePath) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    m_logFilePath = logFilePath;
    m_logFile.open(logFilePath, std::ios::app);
    
    if (!m_logFile.is_open()) {
        return false;
    }
    
    m_logFile.imbue(std::locale(m_logFile.getloc(), new std::codecvt_utf8_utf16<wchar_t>));
    return true;
}

void Logger::Log(LogLevel level, const std::wstring& message, const std::wstring& source) {
    if (level < m_minLevel) return;
    
    std::lock_guard<std::mutex> lock(m_mutex);
    
    std::wstring logEntry = GetTimestamp() + L" [" + LevelToString(level) + L"]";
    
    if (!source.empty()) {
        logEntry += L" [" + source + L"]";
    }
    
    logEntry += L" " + message;
    
    if (m_logFile.is_open()) {
        m_logFile << logEntry << std::endl;
    }
    
    if (level >= LogLevel::Warning) {
        OutputDebugStringW((logEntry + L"\n").c_str());
    }
}

void Logger::Debug(const std::wstring& message, const std::wstring& source) {
    Log(LogLevel::Debug, message, source);
}

void Logger::Info(const std::wstring& message, const std::wstring& source) {
    Log(LogLevel::Info, message, source);
}

void Logger::Warning(const std::wstring& message, const std::wstring& source) {
    Log(LogLevel::Warning, message, source);
}

void Logger::Error(const std::wstring& message, const std::wstring& source) {
    Log(LogLevel::Error, message, source);
}

void Logger::Critical(const std::wstring& message, const std::wstring& source) {
    Log(LogLevel::Critical, message, source);
}

void Logger::SetMinLevel(LogLevel level) {
    m_minLevel = level;
}

void Logger::Flush() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_logFile.is_open()) {
        m_logFile.flush();
    }
}

std::wstring Logger::LevelToString(LogLevel level) {
    switch (level) {
        case LogLevel::Debug: return L"DEBUG";
        case LogLevel::Info: return L"INFO";
        case LogLevel::Warning: return L"WARNING";
        case LogLevel::Error: return L"ERROR";
        case LogLevel::Critical: return L"CRITICAL";
        default: return L"UNKNOWN";
    }
}

std::wstring Logger::GetTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;
    
    struct tm timeInfo;
    localtime_s(&timeInfo, &time_t);
    
    std::wstringstream ss;
    ss << std::put_time(&timeInfo, L"%Y-%m-%d %H:%M:%S");
    ss << L"." << std::setfill(L'0') << std::setw(3) << ms.count();
    
    return ss.str();
}

}
