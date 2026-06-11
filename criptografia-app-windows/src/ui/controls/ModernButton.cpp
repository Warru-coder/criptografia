#include "ModernButton.h"
namespace securecrypt::ui::controls {
HWND ModernButton::Create(HWND hParent, int id, const wchar_t* text, int x, int y, int w, int h) {
    return CreateWindowW(L"BUTTON", text, WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, x, y, w, h, hParent, (HMENU)(INT_PTR)id, NULL, NULL);
}
}
