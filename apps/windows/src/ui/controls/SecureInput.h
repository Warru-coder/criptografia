#pragma once
#include <windows.h>
namespace securecrypt::ui::controls {
class SecureInput {
public:
    static HWND Create(HWND hParent, int id, int x, int y, int w, int h, bool isPassword = false);
    static std::wstring GetText(HWND hInput);
    static void SetText(HWND hInput, const std::wstring& text);
    static void Clear(HWND hInput);
};
}
