#pragma once
#include <windows.h>
namespace securecrypt::ui::dialogs {
class SettingsDialog {
public:
    static INT_PTR Show(HWND hParent);
};
}
