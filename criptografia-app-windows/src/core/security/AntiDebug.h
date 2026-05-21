#pragma once

#include <windows.h>
#include <string>

namespace securecrypt::security {

class AntiDebug {
public:
    static bool IsDebuggerPresent();
    
    static bool IsDebuggerAttached();
    
    static bool CheckRemoteDebugger();
    
    static bool IsBeingDebugged();
    
    static void EnableAntiDebug();
    
    static void DisableAntiDebug();
    
    static bool IsVirtualMachine();
    
    static bool IsCodeIntegrityEnabled();
    
    static std::wstring GetSecurityStatus();

private:
    static bool CheckNtGlobalFlag();
    static bool CheckHeapFlags();
    static bool CheckProcessDebugFlags();
    static bool CheckDebugPort();
    static bool CheckSystemDebuggerInformation();
};

}
