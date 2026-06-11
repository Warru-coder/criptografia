#include "SecureInput.h"
#include "../../core/security/SecureMemory.h"

namespace securecrypt::ui::controls {

HWND SecureInput::Create(HWND hParent, int id, int x, int y, int w, int h, bool isPassword) {
    DWORD style = WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL;
    if (isPassword) style |= ES_PASSWORD;
    return CreateWindowW(L"EDIT", L"", style, x, y, w, h, hParent, (HMENU)(INT_PTR)id, NULL, NULL);
}

std::wstring SecureInput::GetText(HWND hInput) {
    int len = GetWindowTextLengthW(hInput);
    if (len == 0) return L"";
    
    std::wstring text(len + 1, L'\0');
    GetWindowTextW(hInput, &text[0], len + 1);
    text.resize(len);
    return text;
}

void SecureInput::SetText(HWND hInput, const std::wstring& text) {
    SetWindowTextW(hInput, text.c_str());
}

void SecureInput::Clear(HWND hInput) {
    SetWindowTextW(hInput, L"");
}

}
