#pragma once
#include <windows.h>
namespace securecrypt::ui::dialogs {
class AuthDialog {
public:
    static INT_PTR Show(HWND hParent, bool isSetup);
};
}
