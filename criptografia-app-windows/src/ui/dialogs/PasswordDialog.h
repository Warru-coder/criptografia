#pragma once
#include <windows.h>
namespace securecrypt::ui::dialogs {
class PasswordDialog {
public:
    static INT_PTR Show(HWND hParent, bool isEdit, int editId);
};
}
