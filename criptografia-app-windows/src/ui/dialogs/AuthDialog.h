#pragma once
#include <windows.h>
#include <string>

namespace securecrypt::ui::dialogs {

struct AuthDialogResult {
    bool success;
    std::wstring password;
};

class AuthDialog {
public:
    static INT_PTR Show(HWND hParent, bool isSetup);
    static AuthDialogResult LastResult;

private:
    struct DlgData {
        bool isSetup;
        bool done;
        bool success;
        std::wstring password;
        HWND hPassword;
        HWND hConfirm;
        HWND hStrength;
        HWND hOkBtn;
        HWND hErrLabel;
    };

    static LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
    static void UpdateStrengthLabel(HWND hStrength, const std::wstring& password);
};

}
