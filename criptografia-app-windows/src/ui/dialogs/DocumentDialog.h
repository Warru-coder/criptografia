#pragma once
#include <windows.h>
namespace securecrypt::ui::dialogs {
class DocumentDialog {
public:
    static INT_PTR Show(HWND hParent);
};
}
