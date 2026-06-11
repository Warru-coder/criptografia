#pragma once
#include <windows.h>
namespace securecrypt::ui::controls {
class ModernButton {
public:
    static HWND Create(HWND hParent, int id, const wchar_t* text, int x, int y, int w, int h);
};
}
