#include "AntiDebug.h"
#include <winternl.h>
#include <psapi.h>

#pragma comment(lib, "ntdll.lib")

namespace securecrypt::security {

typedef NTSTATUS (NTAPI* NtQueryInformationProcessPtr)(
    HANDLE ProcessHandle,
    ULONG ProcessInformationClass,
    PVOID ProcessInformation,
    ULONG ProcessInformationLength,
    PULONG ReturnLength
);

bool AntiDebug::IsDebuggerPresent() {
    return ::IsDebuggerPresent() != FALSE;
}

bool AntiDebug::IsDebuggerAttached() {
    BOOL debugging;
    return CheckRemoteDebuggerPresent(GetCurrentProcess(), &debugging) && debugging;
}

bool AntiDebug::CheckRemoteDebugger() {
    return IsDebuggerAttached();
}

bool AntiDebug::IsBeingDebugged() {
    if (IsDebuggerPresent()) return true;
    if (IsDebuggerAttached()) return true;
    if (CheckNtGlobalFlag()) return true;
    if (CheckHeapFlags()) return true;
    if (CheckProcessDebugFlags()) return true;
    if (CheckDebugPort()) return true;
    return false;
}

void AntiDebug::EnableAntiDebug() {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (!hNtdll) return;
    
    auto NtSetInformationThread = (NTSTATUS (NTAPI*)(HANDLE, ULONG, PVOID, ULONG))
        GetProcAddress(hNtdll, "NtSetInformationThread");
    
    if (NtSetInformationThread) {
        const ULONG ThreadHideFromDebugger = 0x11;
        NtSetInformationThread(GetCurrentThread(), ThreadHideFromDebugger, NULL, 0);
    }
}

void AntiDebug::AntiDebug::DisableAntiDebug() {
}

bool AntiDebug::IsVirtualMachine() {
    bool isVM = false;
    
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"HARDWARE\\DEVICEMAP\\Scsi\\Scsi Port 0\\Scsi Bus 0\\Target Id 0\\Logical Unit Id 0", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        wchar_t identifier[256];
        DWORD size = sizeof(identifier);
        if (RegQueryValueExW(hKey, L"Identifier", NULL, NULL, (LPBYTE)identifier, &size) == ERROR_SUCCESS) {
            std::wstring id(identifier);
            if (id.find(L"VBOX") != std::wstring::npos ||
                id.find(L"VMware") != std::wstring::npos ||
                id.find(L"Virtual") != std::wstring::npos) {
                isVM = true;
            }
        }
        RegCloseKey(hKey);
    }
    
    if (GetModuleHandleW(L"vgld.dll") ||
        GetModuleHandleW(L"vmGuestLib.dll") ||
        GetModuleHandleW(L"VBoxHook.dll")) {
        isVM = true;
    }
    
    return isVM;
}

bool AntiDebug::IsCodeIntegrityEnabled() {
    HKEY hKey;
    DWORD value = 0;
    DWORD size = sizeof(value);
    
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        RegQueryValueExW(hKey, L"EnableCfg", NULL, NULL, (LPBYTE)&value, &size);
        RegCloseKey(hKey);
    }
    
    return value != 0;
}

std::wstring AntiDebug::GetSecurityStatus() {
    std::wstring status;
    
    status += L"Debugger: ";
    status += IsBeingDebugged() ? L"DETECTED" : L"Not detected";
    status += L"\n";
    
    status += L"Virtual Machine: ";
    status += IsVirtualMachine() ? L"Detected" : L"Not detected";
    status += L"\n";
    
    status += L"Code Integrity: ";
    status += IsCodeIntegrityEnabled() ? L"Enabled" : L"Disabled";
    status += L"\n";
    
    return status;
}

bool AntiDebug::CheckNtGlobalFlag() {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (!hNtdll) return false;
    
    auto pPeb = (PPEB)__readgsqword(0x60);
    if (!pPeb) return false;
    
    DWORD ntGlobalFlag = *(PDWORD)((PBYTE)pPeb + 0xBC);
    return (ntGlobalFlag & 0x70) != 0;
}

bool AntiDebug::CheckHeapFlags() {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (!hNtdll) return false;
    
    auto pPeb = (PPEB)__readgsqword(0x60);
    if (!pPeb || !pPeb->ProcessHeap) return false;
    
    DWORD flags = *(PDWORD)((PBYTE)pPeb->ProcessHeap + 0x40);
    DWORD forceFlags = *(PDWORD)((PBYTE)pPeb->ProcessHeap + 0x44);
    
    return (flags & 0x00000002) != 0 || (forceFlags & 0x40000000) != 0;
}

bool AntiDebug::CheckProcessDebugFlags() {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (!hNtdll) return false;
    
    auto NtQueryInformationProcess = (NtQueryInformationProcessPtr)
        GetProcAddress(hNtdll, "NtQueryInformationProcess");
    
    if (!NtQueryInformationProcess) return false;
    
    ULONG debugFlags = 0;
    NTSTATUS status = NtQueryInformationProcess(
        GetCurrentProcess(),
        0x1F,
        &debugFlags,
        sizeof(debugFlags),
        NULL
    );
    
    return NT_SUCCESS(status) && debugFlags != 0;
}

bool AntiDebug::CheckDebugPort() {
    HMODULE hNtdll = GetModuleHandleW(L"ntdll.dll");
    if (!hNtdll) return false;
    
    auto NtQueryInformationProcess = (NtQueryInformationProcessPtr)
        GetProcAddress(hNtdll, "NtQueryInformationProcess");
    
    if (!NtQueryInformationProcess) return false;
    
    ULONG debugPort = 0;
    NTSTATUS status = NtQueryInformationProcess(
        GetCurrentProcess(),
        7,
        &debugPort,
        sizeof(debugPort),
        NULL
    );
    
    return NT_SUCCESS(status) && debugPort != 0;
}

bool AntiDebug::CheckSystemDebuggerInformation() {
    SYSTEM_KERNEL_DEBUGGER_INFORMATION info;
    NTSTATUS status = NtQuerySystemInformation(
        0x23,
        &info,
        sizeof(info),
        NULL
    );
    
    return NT_SUCCESS(status) && info.KernelDebuggerEnabled;
}

}
