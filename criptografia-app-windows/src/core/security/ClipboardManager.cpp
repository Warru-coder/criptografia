#include "ClipboardManager.h"
#include "SecureMemory.h"
#include <thread>
#include <atomic>

namespace securecrypt::security {

HWND ClipboardManager::m_monitorWindow = NULL;
std::function<void()> ClipboardManager::m_onChangeCallback = nullptr;
bool ClipboardManager::m_isMonitoring = false;

bool ClipboardManager::CopyToClipboard(const std::wstring& text) {
    if (!OpenClipboard(NULL)) return false;
    
    EmptyClipboard();
    
    size_t size = (text.length() + 1) * sizeof(wchar_t);
    HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, size);
    if (!hMem) {
        CloseClipboard();
        return false;
    }
    
    memcpy(GlobalLock(hMem), text.c_str(), size);
    GlobalUnlock(hMem);
    
    if (!SetClipboardData(CF_UNICODETEXT, hMem)) {
        GlobalFree(hMem);
        CloseClipboard();
        return false;
    }
    
    CloseClipboard();
    return true;
}

std::wstring ClipboardManager::GetFromClipboard() {
    if (!OpenClipboard(NULL)) return L"";
    
    HANDLE hData = GetClipboardData(CF_UNICODETEXT);
    if (!hData) {
        CloseClipboard();
        return L"";
    }
    
    const wchar_t* text = static_cast<const wchar_t*>(GlobalLock(hData));
    std::wstring result = text ? text : L"";
    GlobalUnlock(hData);
    
    CloseClipboard();
    return result;
}

bool ClipboardManager::ClearClipboard() {
    if (!OpenClipboard(NULL)) return false;
    EmptyClipboard();
    CloseClipboard();
    return true;
}

void ClipboardManager::CopyWithAutoClear(const std::wstring& text, int clearAfterSeconds) {
    if (!CopyToClipboard(text)) return;
    
    std::thread([clearAfterSeconds]() {
        std::this_thread::sleep_for(std::chrono::seconds(clearAfterSeconds));
        ClearClipboard();
    }).detach();
}

bool ClipboardManager::IsClipboardEmpty() {
    return !IsClipboardFormatAvailable(CF_UNICODETEXT);
}

size_t ClipboardManager::GetClipboardSize() {
    if (!OpenClipboard(NULL)) return 0;
    
    HANDLE hData = GetClipboardData(CF_UNICODETEXT);
    size_t size = hData ? GlobalSize(hData) : 0;
    
    CloseClipboard();
    return size;
}

bool ClipboardManager::MonitorClipboard(std::function<void()> onChange, int intervalMs) {
    if (m_isMonitoring) return false;
    
    m_onChangeCallback = onChange;
    m_isMonitoring = true;
    
    std::thread([intervalMs]() {
        std::wstring lastContent;
        
        while (m_isMonitoring) {
            if (OpenClipboard(NULL)) {
                HANDLE hData = GetClipboardData(CF_UNICODETEXT);
                if (hData) {
                    const wchar_t* text = static_cast<const wchar_t*>(GlobalLock(hData));
                    std::wstring currentContent = text ? text : L"";
                    GlobalUnlock(hData);
                    
                    if (currentContent != lastContent && !lastContent.empty()) {
                        if (m_onChangeCallback) {
                            m_onChangeCallback();
                        }
                    }
                    
                    lastContent = currentContent;
                }
                CloseClipboard();
            }
            
            std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
        }
    }).detach();
    
    return true;
}

void ClipboardManager::StopMonitoring() {
    m_isMonitoring = false;
}

}
