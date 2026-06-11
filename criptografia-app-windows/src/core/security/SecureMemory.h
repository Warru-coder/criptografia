#pragma once

#include <windows.h>
#include <vector>
#include <memory>

namespace securecrypt::security {

class SecureMemory {
public:
    static void SecureClear(void* ptr, size_t size);
    
    static void SecureClearString(std::wstring& str);
    
    static void SecureClearVector(std::vector<BYTE>& vec);
    
    template<typename T>
    static void SecureClear(T& value) {
        SecureClear(&value, sizeof(T));
    }
    
    class SecureBuffer {
    public:
        explicit SecureBuffer(size_t size);
        ~SecureBuffer();
        
        SecureBuffer(const SecureBuffer&) = delete;
        SecureBuffer& operator=(const SecureBuffer&) = delete;
        
        BYTE* data();
        const BYTE* data() const;
        size_t size() const;
        
    private:
        BYTE* m_data;
        size_t m_size;
    };
    
    static bool LockMemory(void* ptr, size_t size);
    
    static bool UnlockMemory(void* ptr, size_t size);
    
    static void* AllocateSecure(size_t size);
    
    static void FreeSecure(void* ptr, size_t size);
};

}
