#include "AuthDialog.h"
namespace securecrypt::ui::dialogs {
INT_PTR AuthDialog::Show(HWND hParent, bool isSetup) {
    return MessageBoxW(hParent, isSetup ? L"Setup master password" : L"Enter master password", L"Authentication", MB_OK);
}
}
