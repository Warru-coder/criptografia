#include "PasswordDialog.h"
#include "../../core/crypto/KeyManager.h"
#include "../../core/storage/SecureDatabase.h"
#include "../../core/storage/StorageManager.h"
#include "../../core/utils/StringUtils.h"
#include "../../data/repository/PasswordRepository.h"
#include <bcrypt.h>

namespace securecrypt::ui::dialogs {

PasswordDialogResult PasswordDialog::LastResult = {};

static constexpr int PDID_OK        = 200;
static constexpr int PDID_CANCEL    = 201;
static constexpr int PDID_TITLE     = 202;
static constexpr int PDID_USER      = 203;
static constexpr int PDID_PASS      = 204;
static constexpr int PDID_URL       = 205;
static constexpr int PDID_NOTES     = 206;
static constexpr int PDID_CAT       = 207;
static constexpr int PDID_TAGS      = 208;
static constexpr int PDID_SHOWPASS  = 209;
static constexpr int PDID_GENPASS   = 210;

std::wstring PasswordDialog::GeneratePassword(int length) {
    const wchar_t charset[] =
        L"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const int charsetLen = static_cast<int>(wcslen(charset));

    std::wstring result(length, L'\0');
    for (int i = 0; i < length; ++i) {
        ULONG rnd = 0;
        BCryptGenRandom(nullptr, reinterpret_cast<PUCHAR>(&rnd), sizeof(rnd), BCRYPT_USE_SYSTEM_PREFERRED_RNG);
        result[i] = charset[rnd % charsetLen];
    }
    return result;
}

LRESULT CALLBACK PasswordDialog::WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    DlgData* data = reinterpret_cast<DlgData*>(GetWindowLongPtrW(hWnd, GWLP_USERDATA));

    switch (msg) {
        case WM_CREATE: {
            CREATESTRUCTW* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
            data = reinterpret_cast<DlgData*>(cs->lpCreateParams);
            SetWindowLongPtrW(hWnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(data));

            const int labelW = 90, editW = 280, editH = 24, margin = 20, gap = 10;
            int y = 15;

            auto makeRow = [&](const wchar_t* label, int id, DWORD extra = 0, int height = editH) -> HWND {
                CreateWindowW(L"STATIC", label, WS_CHILD | WS_VISIBLE,
                    margin, y + 3, labelW, 20, hWnd, nullptr, cs->hInstance, nullptr);
                HWND h = CreateWindowW(L"EDIT", L"",
                    WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL | extra,
                    margin + labelW + gap, y, editW, height, hWnd,
                    (HMENU)(INT_PTR)id, cs->hInstance, nullptr);
                y += height + 8;
                return h;
            };

            data->hTitle    = makeRow(L"Title*:",    PDID_TITLE);
            data->hUsername = makeRow(L"Username:",  PDID_USER);

            // Password row with extra buttons
            CreateWindowW(L"STATIC", L"Password*:", WS_CHILD | WS_VISIBLE,
                margin, y + 3, labelW, 20, hWnd, nullptr, cs->hInstance, nullptr);
            data->hPassword = CreateWindowW(L"EDIT", L"",
                WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD | ES_AUTOHSCROLL,
                margin + labelW + gap, y, editW - 140, editH, hWnd,
                (HMENU)(INT_PTR)PDID_PASS, cs->hInstance, nullptr);
            data->hShowPassBtn = CreateWindowW(L"BUTTON", L"Show",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                margin + labelW + gap + editW - 135, y, 65, editH, hWnd,
                (HMENU)(INT_PTR)PDID_SHOWPASS, cs->hInstance, nullptr);
            data->hGenBtn = CreateWindowW(L"BUTTON", L"Generate",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                margin + labelW + gap + editW - 65, y, 65, editH, hWnd,
                (HMENU)(INT_PTR)PDID_GENPASS, cs->hInstance, nullptr);
            y += editH + 8;

            data->hUrl      = makeRow(L"URL:",       PDID_URL);
            data->hNotes    = makeRow(L"Notes:",     PDID_NOTES, ES_MULTILINE | ES_WANTRETURN, 60);
            data->hCategory = makeRow(L"Category:",  PDID_CAT);
            data->hTags     = makeRow(L"Tags:",      PDID_TAGS);

            // Buttons
            CreateWindowW(L"BUTTON", L"Save",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                440 / 2 - 110, y + 8, 100, 30, hWnd,
                (HMENU)(INT_PTR)PDID_OK, cs->hInstance, nullptr);
            CreateWindowW(L"BUTTON", L"Cancel",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                440 / 2 + 10, y + 8, 100, 30, hWnd,
                (HMENU)(INT_PTR)PDID_CANCEL, cs->hInstance, nullptr);

            // Pre-populate if editing
            if (data->isEdit && data->editId > 0) {
                auto entry = repository::PasswordRepository::GetInstance().GetPasswordById(data->editId);
                if (entry) {
                    SetWindowTextW(data->hTitle,    entry->title.c_str());
                    SetWindowTextW(data->hUsername, entry->username.c_str());
                    SetWindowTextW(data->hPassword, entry->password.c_str());
                    SetWindowTextW(data->hUrl,      entry->url.c_str());
                    SetWindowTextW(data->hNotes,    entry->notes.c_str());
                    SetWindowTextW(data->hCategory, entry->category.c_str());
                    SetWindowTextW(data->hTags,     entry->tags.c_str());
                }
            }

            return 0;
        }

        case WM_COMMAND: {
            if (!data) return 0;
            int id = LOWORD(wParam);

            if (id == PDID_SHOWPASS) {
                data->showingPassword = !data->showingPassword;
                LONG style = GetWindowLongW(data->hPassword, GWL_STYLE);
                if (data->showingPassword) {
                    style &= ~ES_PASSWORD;
                    SetWindowTextW(data->hShowPassBtn, L"Hide");
                } else {
                    style |= ES_PASSWORD;
                    SetWindowTextW(data->hShowPassBtn, L"Show");
                }
                SetWindowLongW(data->hPassword, GWL_STYLE, style);
                // force redraw of the edit control
                wchar_t buf[512] = {};
                GetWindowTextW(data->hPassword, buf, 512);
                SetWindowTextW(data->hPassword, buf);
                SecureZeroMemory(buf, sizeof(buf));
                return 0;
            }

            if (id == PDID_GENPASS) {
                std::wstring gen = GeneratePassword(16);
                SetWindowTextW(data->hPassword, gen.c_str());
                SecureZeroMemory(&gen[0], gen.size() * sizeof(wchar_t));
                return 0;
            }

            if (id == PDID_OK) {
                wchar_t buf[1024] = {};

                GetWindowTextW(data->hTitle, buf, 1024);
                data->data.title = buf;
                SecureZeroMemory(buf, sizeof(buf));

                if (data->data.title.empty()) {
                    MessageBoxW(hWnd, L"Title is required.", L"Validation", MB_ICONWARNING);
                    return 0;
                }

                GetWindowTextW(data->hPassword, buf, 1024);
                data->data.password = buf;
                SecureZeroMemory(buf, sizeof(buf));

                if (data->data.password.empty()) {
                    MessageBoxW(hWnd, L"Password is required.", L"Validation", MB_ICONWARNING);
                    return 0;
                }

                GetWindowTextW(data->hUsername, buf, 1024);
                data->data.username = buf;
                SecureZeroMemory(buf, sizeof(buf));

                GetWindowTextW(data->hUrl, buf, 1024);
                data->data.url = buf;
                SecureZeroMemory(buf, sizeof(buf));

                GetWindowTextW(data->hNotes, buf, 1024);
                data->data.notes = buf;
                SecureZeroMemory(buf, sizeof(buf));

                GetWindowTextW(data->hCategory, buf, 1024);
                data->data.category = buf;
                SecureZeroMemory(buf, sizeof(buf));

                GetWindowTextW(data->hTags, buf, 1024);
                data->data.tags = buf;
                SecureZeroMemory(buf, sizeof(buf));

                data->data.editId = data->editId;
                data->data.isEdit = data->isEdit;
                data->success = true;
                data->done = true;
                return 0;
            }

            if (id == PDID_CANCEL) {
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

INT_PTR PasswordDialog::Show(HWND hParent, bool isEdit, int editId) {
    const wchar_t* className = L"SCPasswordDialog";
    HINSTANCE hInst = GetModuleHandleW(nullptr);

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.lpszClassName = className;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassExW(&wc);

    const int dlgW = 440, dlgH = 520;

    DlgData data = {};
    data.isEdit = isEdit;
    data.editId = editId;
    data.done = false;
    data.success = false;
    data.showingPassword = false;

    RECT rcParent = {};
    if (hParent) GetWindowRect(hParent, &rcParent);
    int x = rcParent.left + ((rcParent.right - rcParent.left) - dlgW) / 2;
    int y = rcParent.top + ((rcParent.bottom - rcParent.top) - dlgH) / 2;
    if (x < 0) x = CW_USEDEFAULT;
    if (y < 0) y = CW_USEDEFAULT;

    HWND hDlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME,
        className,
        isEdit ? L"Edit Password" : L"Add Password",
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
    LastResult.data = data.data;

    return data.success ? IDOK : IDCANCEL;
}

}
