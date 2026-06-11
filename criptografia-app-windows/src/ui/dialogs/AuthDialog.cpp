#include "AuthDialog.h"
#include "../../core/crypto/KeyManager.h"
#include "../../core/storage/SecureDatabase.h"
#include "../../core/storage/StorageManager.h"
#include "../../core/utils/StringUtils.h"

namespace securecrypt::ui::dialogs {

AuthDialogResult AuthDialog::LastResult = {};

static constexpr int ID_OK     = 100;
static constexpr int ID_CANCEL = 101;
static constexpr int ID_PASS   = 102;
static constexpr int ID_CONF   = 103;
static constexpr int ID_STRENGTH = 104;
static constexpr int ID_ERR    = 105;

void AuthDialog::UpdateStrengthLabel(HWND hStrength, const std::wstring& password) {
    if (!hStrength) return;
    int len = static_cast<int>(password.size());
    const wchar_t* label = L"Strength: Too short";
    if (len >= 16) {
        bool hasUpper = false, hasLower = false, hasDigit = false, hasSymbol = false;
        for (wchar_t c : password) {
            if (iswupper(c)) hasUpper = true;
            else if (iswlower(c)) hasLower = true;
            else if (iswdigit(c)) hasDigit = true;
            else hasSymbol = true;
        }
        int score = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSymbol ? 1 : 0);
        if (score == 4) label = L"Strength: Strong";
        else if (score >= 3) label = L"Strength: Good";
        else label = L"Strength: Weak";
    } else if (len >= 8) {
        label = L"Strength: Weak";
    }
    SetWindowTextW(hStrength, label);
}

LRESULT CALLBACK AuthDialog::WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    DlgData* data = reinterpret_cast<DlgData*>(GetWindowLongPtrW(hWnd, GWLP_USERDATA));

    switch (msg) {
        case WM_CREATE: {
            CREATESTRUCTW* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
            data = reinterpret_cast<DlgData*>(cs->lpCreateParams);
            SetWindowLongPtrW(hWnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(data));

            int y = 20;
            const int labelW = 100, editW = 220, editH = 24, margin = 30;

            // Password field
            CreateWindowW(L"STATIC", L"Master Password:", WS_CHILD | WS_VISIBLE,
                margin, y + 3, labelW, 20, hWnd, nullptr, cs->hInstance, nullptr);
            data->hPassword = CreateWindowW(L"EDIT", L"",
                WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD | ES_AUTOHSCROLL,
                margin + labelW + 10, y, editW, editH, hWnd, (HMENU)(INT_PTR)ID_PASS, cs->hInstance, nullptr);
            y += editH + 12;

            if (data->isSetup) {
                // Confirm field
                CreateWindowW(L"STATIC", L"Confirm Password:", WS_CHILD | WS_VISIBLE,
                    margin, y + 3, labelW, 20, hWnd, nullptr, cs->hInstance, nullptr);
                data->hConfirm = CreateWindowW(L"EDIT", L"",
                    WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD | ES_AUTOHSCROLL,
                    margin + labelW + 10, y, editW, editH, hWnd, (HMENU)(INT_PTR)ID_CONF, cs->hInstance, nullptr);
                y += editH + 12;

                // Strength label
                data->hStrength = CreateWindowW(L"STATIC", L"Strength: Too short",
                    WS_CHILD | WS_VISIBLE,
                    margin, y, 260, 20, hWnd, (HMENU)(INT_PTR)ID_STRENGTH, cs->hInstance, nullptr);
                y += 28;
            }

            // Error label
            data->hErrLabel = CreateWindowW(L"STATIC", L"",
                WS_CHILD | WS_VISIBLE | SS_CENTER,
                margin, y, editW + labelW + 10, 20, hWnd, (HMENU)(INT_PTR)ID_ERR, cs->hInstance, nullptr);
            y += 28;

            // Buttons
            int dlgW = data->isSetup ? 380 : 380;
            data->hOkBtn = CreateWindowW(L"BUTTON", data->isSetup ? L"Create Vault" : L"Unlock",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                dlgW / 2 - 110, y, 100, 30, hWnd, (HMENU)(INT_PTR)ID_OK, cs->hInstance, nullptr);
            CreateWindowW(L"BUTTON", L"Cancel",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                dlgW / 2 + 10, y, 100, 30, hWnd, (HMENU)(INT_PTR)ID_CANCEL, cs->hInstance, nullptr);

            return 0;
        }

        case WM_COMMAND: {
            if (!data) return 0;
            int id = LOWORD(wParam);
            int note = HIWORD(wParam);

            if (id == ID_PASS && note == EN_CHANGE && data->isSetup) {
                wchar_t buf[256] = {};
                GetWindowTextW(data->hPassword, buf, 256);
                UpdateStrengthLabel(data->hStrength, buf);
                SecureZeroMemory(buf, sizeof(buf));
            }

            if (id == ID_OK) {
                wchar_t passBuf[256] = {};
                GetWindowTextW(data->hPassword, passBuf, 256);
                std::wstring pwd(passBuf);
                SecureZeroMemory(passBuf, sizeof(passBuf));

                if (data->isSetup) {
                    wchar_t confBuf[256] = {};
                    GetWindowTextW(data->hConfirm, confBuf, 256);
                    std::wstring conf(confBuf);
                    SecureZeroMemory(confBuf, sizeof(confBuf));

                    if (pwd.size() < 8) {
                        SetWindowTextW(data->hErrLabel, L"Password must be at least 8 characters.");
                        SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                        SecureZeroMemory(&conf[0], conf.size() * sizeof(wchar_t));
                        return 0;
                    }
                    if (pwd != conf) {
                        SetWindowTextW(data->hErrLabel, L"Passwords do not match.");
                        SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                        SecureZeroMemory(&conf[0], conf.size() * sizeof(wchar_t));
                        return 0;
                    }
                    SecureZeroMemory(&conf[0], conf.size() * sizeof(wchar_t));

                    if (!crypto::KeyManager::GetInstance().Initialize(pwd)) {
                        SetWindowTextW(data->hErrLabel, L"Failed to initialize vault.");
                        SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                        return 0;
                    }
                } else {
                    if (!crypto::KeyManager::GetInstance().Unlock(pwd)) {
                        SetWindowTextW(data->hErrLabel, L"Incorrect password.");
                        SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                        return 0;
                    }
                }

                if (!storage::SecureDatabase::GetInstance().Initialize(
                        storage::StorageManager::GetInstance().GetDatabasePath())) {
                    SetWindowTextW(data->hErrLabel, L"Failed to open database.");
                    SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                    return 0;
                }

                data->password = pwd;
                SecureZeroMemory(&pwd[0], pwd.size() * sizeof(wchar_t));
                data->success = true;
                data->done = true;
                return 0;
            }

            if (id == ID_CANCEL) {
                data->success = false;
                data->done = true;
                return 0;
            }
            return 0;
        }

        case WM_CLOSE:
            if (data) {
                data->success = false;
                data->done = true;
            }
            return 0;

        default:
            return DefWindowProcW(hWnd, msg, wParam, lParam);
    }
}

INT_PTR AuthDialog::Show(HWND hParent, bool isSetup) {
    const wchar_t* className = L"SCAuthDialog";
    HINSTANCE hInst = GetModuleHandleW(nullptr);

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.lpszClassName = className;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassExW(&wc);

    int dlgW = 380;
    int dlgH = isSetup ? 260 : 200;

    DlgData data = {};
    data.isSetup = isSetup;
    data.done = false;
    data.success = false;

    RECT rcParent = {};
    if (hParent) GetWindowRect(hParent, &rcParent);
    int x = rcParent.left + ((rcParent.right - rcParent.left) - dlgW) / 2;
    int y = rcParent.top + ((rcParent.bottom - rcParent.top) - dlgH) / 2;
    if (x < 0) x = CW_USEDEFAULT;
    if (y < 0) y = CW_USEDEFAULT;

    HWND hDlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME | WS_EX_TOPMOST,
        className,
        isSetup ? L"Create Master Password" : L"Unlock SecureCrypt",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        x, y, dlgW, dlgH,
        hParent, nullptr, hInst, &data
    );

    if (!hDlg) return IDCANCEL;

    if (hParent) EnableWindow(hParent, FALSE);
    ShowWindow(hDlg, SW_SHOW);
    UpdateWindow(hDlg);

    MSG msg = {};
    while (!data.done && GetMessageW(&msg, nullptr, 0, 0)) {
        if (!IsDialogMessageW(hDlg, &msg)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    if (hParent) {
        EnableWindow(hParent, TRUE);
        SetForegroundWindow(hParent);
    }

    DestroyWindow(hDlg);

    LastResult.success = data.success;
    LastResult.password = data.password;

    return data.success ? IDOK : IDCANCEL;
}

}
