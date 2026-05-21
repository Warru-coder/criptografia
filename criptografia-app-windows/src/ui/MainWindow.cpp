#include "MainWindow.h"
#include "../app/AppController.h"
#include "../core/utils/Logger.h"
#include "../core/utils/StringUtils.h"
#include "../core/crypto/KeyManager.h"
#include "../core/crypto/PasswordGenerator.h"
#include "../data/repository/PasswordRepository.h"
#include "dialogs/AuthDialog.h"
#include "dialogs/PasswordDialog.h"
#include "dialogs/DocumentDialog.h"
#include "dialogs/SettingsDialog.h"

#pragma comment(lib, "comctl32.lib")

namespace securecrypt::ui {

MainWindow* MainWindow::s_instance = nullptr;

MainWindow::MainWindow() : m_hWnd(NULL), m_hTab(NULL), m_hListView(NULL), m_hToolBar(NULL), m_hStatusBar(NULL), m_hInstance(NULL), m_isLocked(true), m_isInitialized(false) {
    s_instance = this;
}

MainWindow::~MainWindow() {
    s_instance = nullptr;
}

bool MainWindow::RegisterWindowClass() {
    WNDCLASSEXW wcex = {};
    wcex.cbSize = sizeof(WNDCLASSEXW);
    wcex.style = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc = WndProc;
    wcex.hInstance = m_hInstance;
    wcex.hIcon = LoadIconW(m_hInstance, MAKEINTRESOURCEW(1));
    wcex.hCursor = LoadCursorW(NULL, IDC_ARROW);
    wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wcex.lpszClassName = L"SecureCryptMainWindow";
    wcex.hIconSm = LoadIconW(wcex.hInstance, MAKEINTRESOURCEW(1));
    
    return RegisterClassExW(&wcex) != 0;
}

bool MainWindow::CreateMainWindow(int nCmdShow) {
    m_hWnd = CreateWindowExW(
        0,
        L"SecureCryptMainWindow",
        L"SecureCrypt - Password & Document Vault",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1200, 800,
        NULL, NULL, m_hInstance, this
    );
    
    if (!m_hWnd) return false;
    
    EnableDarkTitleBar();
    ShowWindow(m_hWnd, nCmdShow);
    UpdateWindow(m_hWnd);
    
    return true;
}

bool MainWindow::CreateTabControl() {
    m_hTab = CreateWindowW(WC_TABCONTROL, L"",
        WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | TCS_TOOLTIPS,
        0, 0, 0, 0, m_hWnd, NULL, m_hInstance, NULL);
    
    if (!m_hTab) return false;
    
    TCITEMW tie = {};
    tie.mask = TCIF_TEXT;
    
    tie.pszText = const_cast<LPWSTR>(L"Passwords");
    TabCtrl_InsertItem(m_hTab, static_cast<int>(TabIndex::Passwords), &tie);
    
    tie.pszText = const_cast<LPWSTR>(L"Documents");
    TabCtrl_InsertItem(m_hTab, static_cast<int>(TabIndex::Documents), &tie);
    
    tie.pszText = const_cast<LPWSTR>(L"Notes");
    TabCtrl_InsertItem(m_hTab, static_cast<int>(TabIndex::Notes), &tie);
    
    tie.pszText = const_cast<LPWSTR>(L"Settings");
    TabCtrl_InsertItem(m_hTab, static_cast<int>(TabIndex::Settings), &tie);
    
    return true;
}

bool MainWindow::CreateListView() {
    m_hListView = CreateWindowW(WC_LISTVIEW, L"",
        WS_CHILD | WS_VISIBLE | WS_BORDER | LVS_REPORT | LVS_SINGLESEL | LVS_SHOWSELALWAYS,
        0, 0, 0, 0, m_hWnd, NULL, m_hInstance, NULL);
    
    if (!m_hListView) return false;
    
    ListView_SetExtendedListViewStyle(m_hListView, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES | LVS_EX_DOUBLEBUFFER);
    
    LVCOLUMNW lvc = {};
    lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_FMT;
    lvc.fmt = LVCFMT_LEFT;
    
    lvc.pszText = const_cast<LPWSTR>(L"Title");
    lvc.cx = 300;
    ListView_InsertColumn(m_hListView, 0, &lvc);
    
    lvc.pszText = const_cast<LPWSTR>(L"Username");
    lvc.cx = 200;
    ListView_InsertColumn(m_hListView, 1, &lvc);
    
    lvc.pszText = const_cast<LPWSTR>(L"Category");
    lvc.cx = 120;
    ListView_InsertColumn(m_hListView, 2, &lvc);
    
    lvc.pszText = const_cast<LPWSTR>(L"Last Accessed");
    lvc.cx = 150;
    ListView_InsertColumn(m_hListView, 3, &lvc);
    
    return true;
}

bool MainWindow::CreateToolBar() {
    m_hToolBar = CreateToolbarEx(m_hWnd,
        WS_CHILD | WS_VISIBLE | TBSTYLE_TOOLTIPS | TBSTYLE_FLAT | CCS_TOP,
        1, 0, NULL, 0, NULL, 0, 16, 16, 16, 16, sizeof(TBBUTTON));
    
    if (!m_hToolBar) return false;
    
    TBBUTTON buttons[] = {
        {0, 1, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Add"},
        {0, 2, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Edit"},
        {0, 3, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Delete"},
        {0, 0, TBSTATE_ENABLED, BTNS_SEP, {0}, 0, 0},
        {0, 4, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Search"},
        {0, 5, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Refresh"},
        {0, 0, TBSTATE_ENABLED, BTNS_SEP, {0}, 0, 0},
        {0, 6, TBSTATE_ENABLED, BTNS_BUTTON, {0}, 0, (INT_PTR)L"Lock"}
    };
    
    for (auto& btn : buttons) {
        SendMessageW(m_hToolBar, TB_ADDBUTTONS, 1, (LPARAM)&btn);
    }
    
    return true;
}

bool MainWindow::CreateStatusBar() {
    m_hStatusBar = CreateStatusWindowW(WS_CHILD | WS_VISIBLE | SBARS_SIZEGRIP, L"Ready", m_hWnd, 2);
    return m_hStatusBar != NULL;
}

bool MainWindow::Create(HINSTANCE hInstance, int nCmdShow) {
    m_hInstance = hInstance;
    
    if (!RegisterWindowClass()) return false;
    if (!CreateMainWindow(nCmdShow)) return false;
    if (!CreateTabControl()) return false;
    if (!CreateListView()) return false;
    if (!CreateToolBar()) return false;
    if (!CreateStatusBar()) return false;
    
    m_isInitialized = true;
    m_isLocked = false;
    
    LoadPasswords();
    
    return true;
}

int MainWindow::Run() {
    MSG msg;
    HACCEL hAccelTable = LoadAcceleratorsW(m_hInstance, MAKEINTRESOURCEW(1));
    
    while (GetMessageW(&msg, NULL, 0, 0)) {
        if (!TranslateAcceleratorW(m_hWnd, hAccelTable, &msg)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
    
    return static_cast<int>(msg.wParam);
}

LRESULT CALLBACK MainWindow::WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    MainWindow* This = s_instance;
    
    switch (message) {
        case WM_CREATE:
            return 0;
            
        case WM_SIZE:
            if (This) This->OnSize(wParam, lParam);
            return 0;
            
        case WM_NOTIFY:
            if (((LPNMHDR)lParam)->code == TCN_SELCHANGE && This) {
                This->OnTabChanged();
            }
            return 0;
            
        case WM_COMMAND:
            if (This) {
                int wmId = LOWORD(wParam);
                switch (wmId) {
                    case 1: This->OnAdd(); break;
                    case 2: This->OnEdit(); break;
                    case 3: This->OnDelete(); break;
                    case 6: This->LockApp(); break;
                }
            }
            return 0;
            
        case WM_CLOSE:
            if (This) This->LockApp();
            DestroyWindow(hWnd);
            return 0;
            
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
            
        default:
            return DefWindowProcW(hWnd, message, wParam, lParam);
    }
}

void MainWindow::OnSize(WPARAM wParam, LPARAM lParam) {
    if (!m_isInitialized) return;
    
    RECT rcClient, rcTab, rcTool, rcStatus;
    GetClientRect(m_hWnd, &rcClient);
    GetWindowRect(m_hToolBar, &rcTool);
    GetWindowRect(m_hStatusBar, &rcStatus);
    
    int toolHeight = rcTool.bottom - rcTool.top;
    int statusHeight = rcStatus.bottom - rcStatus.top;
    
    SetWindowPos(m_hToolBar, NULL, 0, 0, rcClient.right, toolHeight, SWP_NOZORDER);
    SetWindowPos(m_hStatusBar, NULL, 0, rcClient.bottom - statusHeight, rcClient.right, statusHeight, SWP_NOZORDER);
    SetWindowPos(m_hTab, NULL, 0, toolHeight, rcClient.right, rcClient.bottom - toolHeight - statusHeight, SWP_NOZORDER);
    
    GetClientRect(m_hTab, &rcTab);
    int tabHeight = rcTab.bottom - rcTab.top;
    SetWindowPos(m_hListView, NULL, 0, 0, rcClient.right, tabHeight - 30, SWP_NOZORDER | SWP_NOMOVE);
}

void MainWindow::OnTabChanged() {
    int sel = TabCtrl_GetCurSel(m_hTab);
    
    switch (sel) {
        case static_cast<int>(TabIndex::Passwords):
            LoadPasswords();
            break;
        case static_cast<int>(TabIndex::Documents):
            LoadDocuments();
            break;
        case static_cast<int>(TabIndex::Notes):
            LoadNotes();
            break;
        case static_cast<int>(TabIndex::Settings):
            break;
    }
}

void MainWindow::OnSearch() {
    LoadPasswords();
}

void MainWindow::OnAdd() {
    int sel = TabCtrl_GetCurSel(m_hTab);
    
    switch (sel) {
        case static_cast<int>(TabIndex::Passwords):
            ShowPasswordDialog();
            break;
        case static_cast<int>(TabIndex::Documents):
            ShowDocumentDialog();
            break;
    }
}

void MainWindow::OnDelete() {
    int sel = ListView_GetNextItem(m_hListView, -1, LVNI_SELECTED);
    if (sel == -1) return;
    
    LVITEMW lvi = {};
    lvi.iItem = sel;
    lvi.iSubItem = 0;
    lvi.pszText = new wchar_t[256];
    lvi.cchTextMax = 256;
    ListView_GetItem(m_hListView, &lvi);
    
    int result = MessageBoxW(m_hWnd, (std::wstring(L"Delete '") + lvi.pszText + L"'?").c_str(),
                            L"Confirm Delete", MB_YESNO | MB_ICONWARNING);
    
    if (result == IDYES) {
        auto& repo = repository::PasswordRepository::GetInstance();
        repo.DeletePassword(sel + 1);
        LoadPasswords();
        UpdateStatusBar(L"Item deleted");
    }
    
    delete[] lvi.pszText;
}

void MainWindow::OnEdit() {
    int sel = ListView_GetNextItem(m_hListView, -1, LVNI_SELECTED);
    if (sel == -1) return;
    
    ShowPasswordDialog(true, sel + 1);
}

void MainWindow::OnCopyToClipboard(const std::wstring& text) {
    if (!OpenClipboard(m_hWnd)) return;
    EmptyClipboard();
    
    size_t size = (text.length() + 1) * sizeof(wchar_t);
    HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, size);
    if (hMem) {
        memcpy(GlobalLock(hMem), text.c_str(), size);
        GlobalUnlock(hMem);
        SetClipboardData(CF_UNICODETEXT, hMem);
    }
    
    CloseClipboard();
    UpdateStatusBar(L"Copied to clipboard (auto-clear in 30s)");
}

void MainWindow::OnToggleFavorite() {
    int sel = ListView_GetNextItem(m_hListView, -1, LVNI_SELECTED);
    if (sel == -1) return;
    
    auto& repo = repository::PasswordRepository::GetInstance();
    auto entry = repo.GetPasswordById(sel + 1);
    if (entry) {
        repo.ToggleFavorite(sel + 1, !entry->isFavorite);
        LoadPasswords();
    }
}

void MainWindow::OnRefresh() {
    OnTabChanged();
    UpdateStatusBar(L"Refreshed");
}

void MainWindow::LoadPasswords() {
    ListView_DeleteAllItems(m_hListView);
    
    auto& repo = repository::PasswordRepository::GetInstance();
    auto passwords = repo.GetAllPasswords();
    
    for (size_t i = 0; i < passwords.size(); ++i) {
        LVITEMW lvi = {};
        lvi.iItem = static_cast<int>(i);
        lvi.iSubItem = 0;
        lvi.pszText = const_cast<LPWSTR>(passwords[i].title.c_str());
        ListView_InsertItem(m_hListView, &lvi);
        
        ListView_SetItemText(m_hListView, static_cast<int>(i), 1, const_cast<LPWSTR>(passwords[i].username.c_str()));
        ListView_SetItemText(m_hListView, static_cast<int>(i), 2, const_cast<LPWSTR>(passwords[i].category.c_str()));
        ListView_SetItemText(m_hListView, static_cast<int>(i), 3, const_cast<LPWSTR>(L"Never"));
    }
    
    UpdateStatusBar(std::to_wstring(passwords.size()) + L" passwords loaded");
}

void MainWindow::LoadDocuments() {
    ListView_DeleteAllItems(m_hListView);
    
    LVCOLUMNW lvc = {};
    lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_FMT;
    lvc.fmt = LVCFMT_LEFT;
    
    ListView_DeleteColumn(m_hListView, 3);
    ListView_DeleteColumn(m_hListView, 2);
    ListView_DeleteColumn(m_hListView, 1);
    ListView_DeleteColumn(m_hListView, 0);
    
    lvc.pszText = const_cast<LPWSTR>(L"Document");
    lvc.cx = 400;
    ListView_InsertColumn(m_hListView, 0, &lvc);
    
    lvc.pszText = const_cast<LPWSTR>(L"Size");
    lvc.cx = 100;
    ListView_InsertColumn(m_hListView, 1, &lvc);
    
    lvc.pszText = const_cast<LPWSTR>(L"Type");
    lvc.cx = 150;
    ListView_InsertColumn(m_hListView, 2, &lvc);
    
    UpdateStatusBar(L"Documents view");
}

void MainWindow::LoadNotes() {
    ListView_DeleteAllItems(m_hListView);
    UpdateStatusBar(L"Notes view");
}

void MainWindow::UpdateStatusBar(const std::wstring& text) {
    if (m_hStatusBar) {
        SendMessageW(m_hStatusBar, SB_SETTEXT, 0, (LPARAM)text.c_str());
    }
}

void MainWindow::ApplyModernTheme() {
    HMODULE hUxtheme = LoadLibraryW(L"uxtheme.dll");
    if (hUxtheme) {
        auto SetPreferredAppMode = (HRESULT(WINAPI*)(int))GetProcAddress(hUxtheme, MAKEINTRESOURCEA(135));
        auto FlushMenuThemes = (void(WINAPI*)())GetProcAddress(hUxtheme, MAKEINTRESOURCEA(136));
        
        if (SetPreferredAppMode) SetPreferredAppMode(1);
        if (FlushMenuThemes) FlushMenuThemes();
        
        FreeLibrary(hUxtheme);
    }
    
    DwmSetWindowAttribute(m_hWnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &(BOOL){TRUE}, sizeof(BOOL));
}

void MainWindow::EnableDarkTitleBar() {
    BOOL value = TRUE;
    DwmSetWindowAttribute(m_hWnd, 20, &value, sizeof(value));
}

void MainWindow::ShowAuthDialog() {
    if (app::AppController::GetInstance().IsFirstRun()) {
        MessageBoxW(m_hWnd, L"Welcome to SecureCrypt!\n\nPlease create a master password to get started.",
                   L"Setup", MB_ICONINFORMATION);
    } else {
        MessageBoxW(m_hWnd, L"Please enter your master password to unlock.",
                   L"Unlock", MB_ICONINFORMATION);
    }
}

void MainWindow::ShowPasswordDialog(bool isEdit, int editId) {
    MessageBoxW(m_hWnd, L"Password dialog placeholder", L"Add Password", MB_ICONINFORMATION);
}

void MainWindow::ShowDocumentDialog() {
    MessageBoxW(m_hWnd, L"Document dialog placeholder", L"Import Document", MB_ICONINFORMATION);
}

void MainWindow::ShowSettingsDialog() {
    MessageBoxW(m_hWnd, L"Settings dialog placeholder", L"Settings", MB_ICONINFORMATION);
}

void MainWindow::LockApp() {
    app::AppController::GetInstance().Lock();
    m_isLocked = true;
    ListView_DeleteAllItems(m_hListView);
    UpdateStatusBar(L"Locked - Restart to unlock");
}

bool MainWindow::IsLocked() const {
    return m_isLocked;
}

}
