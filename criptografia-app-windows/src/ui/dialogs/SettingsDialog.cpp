#include "SettingsDialog.h"
namespace securecrypt::ui::dialogs {
INT_PTR SettingsDialog::Show(HWND hParent) {
    return MessageBoxW(hParent, L"Settings panel", L"Settings", MB_OK);
}
}
