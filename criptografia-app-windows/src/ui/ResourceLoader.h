#pragma once
#include <windows.h>
#include <string>

namespace securecrypt::ui {
class ResourceLoader {
public:
    static std::wstring LoadString(UINT id);
    static HICON LoadIcon(UINT id);
    static HBITMAP LoadBitmap(UINT id);
    static HCURSOR LoadCursor(UINT id);
};
}
