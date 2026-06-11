#include "ResourceLoader.h"

namespace securecrypt::ui {

std::wstring ResourceLoader::LoadString(UINT id) {
    wchar_t buffer[1024];
    LoadStringW(GetModuleHandle(NULL), id, buffer, 1024);
    return std::wstring(buffer);
}

HICON ResourceLoader::LoadIcon(UINT id) {
    return (HICON)LoadImageW(GetModuleHandle(NULL), MAKEINTRESOURCEW(id), IMAGE_ICON, 0, 0, LR_DEFAULTSIZE);
}

HBITMAP ResourceLoader::LoadBitmap(UINT id) {
    return (HBITMAP)LoadImageW(GetModuleHandle(NULL), MAKEINTRESOURCEW(id), IMAGE_BITMAP, 0, 0, LR_DEFAULTSIZE);
}

HCURSOR ResourceLoader::LoadCursor(UINT id) {
    return (HCURSOR)LoadImageW(GetModuleHandle(NULL), MAKEINTRESOURCEW(id), IMAGE_CURSOR, 0, 0, LR_DEFAULTSIZE);
}

}
