#include "SecureMemory.h"

namespace securecrypt::security {

void SecureMemory::SecureClear(void* ptr, size_t size) {
    if (ptr && size > 0) {
        SecureZeroMemory(ptr, size);
        
        volatile BYTE* p = static_cast<volatile BYTE*>(ptr);
        for (size_t i = 0; i < size; ++i) {
            p[i] = 0;
        }
    }
}

void SecureMemory::SecureClearString(std::wstring& str) {
    if (!str.empty()) {
        SecureZeroMemory(str.data(), str.size() * sizeof(wchar_t));
        str.clear();
        str.shrink_to_fit();
    }
}

void SecureMemory::SecureClearVector(std::vector<BYTE>& vec) {
    if (!vec.empty()) {
        SecureZeroMemory(vec.data(), vec.size());
        vec.clear();
        vec.shrink_to_fit();
    }
}

SecureMemory::SecureBuffer::SecureBuffer(size_t size) : m_data(nullptr), m_size(size) {
    m_data = static_cast<BYTE*>(VirtualAlloc(NULL, size, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE));
    if (m_data) {
        DWORD oldProtect;
        VirtualProtect(m_data, size, PAGE_READWRITE | PAGE_NOCACHE, &oldProtect);
    }
}

SecureMemory::SecureBuffer::~SecureBuffer() {
    if (m_data) {
        SecureClear(m_data, m_size);
        VirtualFree(m_data, 0, MEM_RELEASE);
    }
}

BYTE* SecureMemory::SecureBuffer::data() {
    return m_data;
}

const BYTE* SecureMemory::SecureBuffer::data() const {
    return m_data;
}

size_t SecureMemory::SecureBuffer::size() const {
    return m_size;
}

bool SecureMemory::LockMemory(void* ptr, size_t size) {
    return VirtualLock(ptr, size) != FALSE;
}

bool SecureMemory::UnlockMemory(void* ptr, size_t size) {
    return VirtualUnlock(ptr, size) != FALSE;
}

void* SecureMemory::AllocateSecure(size_t size) {
    void* ptr = VirtualAlloc(NULL, size, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (ptr) {
        VirtualLock(ptr, size);
        SecureZeroMemory(ptr, size);
    }
    return ptr;
}

void SecureMemory::FreeSecure(void* ptr, size_t size) {
    if (ptr) {
        SecureClear(ptr, size);
        VirtualUnlock(ptr, size);
        VirtualFree(ptr, 0, MEM_RELEASE);
    }
}

}
