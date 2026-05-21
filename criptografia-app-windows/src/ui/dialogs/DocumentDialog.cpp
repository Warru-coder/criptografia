#include "DocumentDialog.h"
namespace securecrypt::ui::dialogs {
INT_PTR DocumentDialog::Show(HWND hParent) {
    return MessageBoxW(hParent, L"Import or export documents", L"Documents", MB_OK);
}
}
