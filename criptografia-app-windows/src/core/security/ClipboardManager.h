#pragma once

#include <windows.h>
#include <string>
#include <functional>
#include <chrono>

namespace securecrypt::security {

class ClipboardManager {
public:
    static bool CopyToClipboard(const std::wstring& text);
    
    static std::wstring GetFromClipboard();
    
    static bool ClearClipboard();
    
    static void CopyWithAutoClear(const std::wstring& text, int clearAfterSeconds = 30);
    
    static bool IsClipboardEmpty();
    
    static size_t GetClipboardSize();
    
    static bool MonitorClipboard(std::function<void()> onChange, int intervalMs = 1000);
    
    static void StopMonitoring();

private:
    static HWND m_monitorWindow;
    static std::function<void()> m_onChangeCallback;
    static bool m_isMonitoring;
};

}
