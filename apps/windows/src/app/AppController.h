#pragma once

#include <windows.h>
#include <string>

namespace securecrypt::app {

class AppController {
public:
    static AppController& GetInstance();
    
    bool Initialize(HINSTANCE hInstance);
    
    int Run(HINSTANCE hInstance, int nCmdShow);
    
    void Shutdown();
    
    bool IsFirstRun();
    
    bool IsAuthenticated();
    
    void Lock();
    
    void Unlock();
    
    std::wstring GetVersion() const;

private:
    AppController();
    ~AppController();
    
    bool m_isInitialized;
    bool m_isAuthenticated;
    bool m_isFirstRun;
    std::wstring m_version;
    
    bool SetupDirectories();
    
    bool CheckForUpdates();
    
    void RegisterSingleInstance();
};

}
