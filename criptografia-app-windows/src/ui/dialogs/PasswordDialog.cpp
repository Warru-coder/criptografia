#include "PasswordDialog.h"
namespace securecrypt::ui::dialogs {
INT_PTR PasswordDialog::Show(HWND hParent, bool isEdit, int editId) {
    return MessageBoxW(hParent, isEdit ? L"Edit password" : L"Add new password", L"Password", MB_OK);
}
}
