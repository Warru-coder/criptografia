#pragma once
#include <windows.h>
#include <string>

namespace securecrypt::ui::dialogs {

struct PasswordData {
    std::wstring title;
    std::wstring username;
    std::wstring password;
    std::wstring url;
    std::wstring notes;
    std::wstring category;
    std::wstring tags;
    int editId;
    bool isEdit;
};

struct PasswordDialogResult {
    bool success;
    PasswordData data;
};

class PasswordDialog {
public:
    static INT_PTR Show(HWND hParent, bool isEdit = false, int editId = -1);
    static PasswordDialogResult LastResult;

private:
    struct DlgData {
        bool isEdit;
        int editId;
        bool done;
        bool success;
        PasswordData data;
        bool showingPassword;
        HWND hTitle, hUsername, hPassword, hUrl, hNotes, hCategory, hTags;
        HWND hShowPassBtn, hGenBtn;
    };

    static LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
    static std::wstring GeneratePassword(int length = 16);
};

}
